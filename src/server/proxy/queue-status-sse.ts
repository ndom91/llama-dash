import type { ModelScheduler, QueueStatus } from './model-scheduler.ts'

/** Keep-alive interval for queued SSE clients. */
const PING_INTERVAL_MS = 5_000

/**
 * Completion endpoints that may early-commit the progress SSE tape when the
 * client sets `stream: true`. Non-stream never uses SSE — long-poll + queue headers.
 */
export function endpointSupportsProgressTape(endpoint: string): boolean {
  return endpoint === '/v1/chat/completions' || endpoint === '/v1/completions' || endpoint === '/v1/messages'
}

/**
 * Local-backend routes that must not compete for the concurrency queue.
 *
 * Rule: anything that can trigger a model switch or run inference must be
 * queued. Only pure catalog/metadata lookups bypass — today that is
 * `/v1/models` and `/v1/models/{id}`. Token counting, embeddings, audio,
 * images, and all completion endpoints stay queued.
 */
export function endpointBypassesLocalQueue(endpoint: string): boolean {
  return endpoint === '/v1/models' || endpoint.startsWith('/v1/models/')
}

export type SseProgressPipeOptions = {
  /**
   * When true, non-SSE upstream bodies are re-framed as one `data:` JSON event
   * plus `[DONE]` so non-stream shares the `: queued` / `: relayed` tape with stream.
   */
  wrapJsonAsSse?: boolean
}

async function pipeUpstreamToSseController(
  controller: ReadableStreamDefaultController<Uint8Array>,
  upstreamResponse: Response,
  encoder: TextEncoder,
  opts: {
    wrapJsonAsSse: boolean
    stopped: () => boolean
    setReader: (reader: ReadableStreamDefaultReader<Uint8Array> | null) => void
  },
): Promise<void> {
  if (!upstreamResponse.body) {
    controller.close()
    return
  }

  const contentType = upstreamResponse.headers.get('content-type') ?? ''
  const upstreamIsSse = contentType.includes('text/event-stream')
  if (opts.wrapJsonAsSse && !upstreamIsSse) {
    const text = await upstreamResponse.text()
    if (opts.stopped()) return
    const payload = text.trim() || '{}'
    controller.enqueue(encoder.encode(`data: ${payload}\n\n`))
    controller.enqueue(encoder.encode('data: [DONE]\n\n'))
    controller.close()
    return
  }

  const reader = upstreamResponse.body.getReader()
  opts.setReader(reader)
  while (!opts.stopped()) {
    const { done, value } = await reader.read()
    if (done) {
      controller.close()
      return
    }
    controller.enqueue(value)
  }
  await reader.cancel().catch(() => {})
  try {
    controller.close()
  } catch {
    // already closed
  }
}

export function formatQueueComment(status: QueueStatus, model: string, requestId: string): string {
  const eta = status.estimatedEtaMs != null ? `${Math.round(status.estimatedEtaMs / 1000)}s` : '?s'
  return `: queued position=${status.position} eta=${eta} model=${model} request_id=${requestId}`
}

/** RELAY marker: queue done + dispatched to backend. `at_ms` is always 0 (origin). */
export function formatRelayedComment(atMs = 0): string {
  return `: relayed at_ms=${Math.max(0, Math.round(atMs))}`
}

/**
 * REASON marker: first reasoning token.
 * `atMs` is milliseconds after RELAY (never wall-clock epoch).
 */
export function formatReasonComment(atMs?: number): string {
  return atMs != null ? `: reason at_ms=${Math.max(0, Math.round(atMs))}` : ': reason'
}

/**
 * RESPOND marker: first visible content token.
 * `atMs` is milliseconds after RELAY (never wall-clock epoch).
 */
export function formatRespondComment(atMs?: number): string {
  return atMs != null ? `: respond at_ms=${Math.max(0, Math.round(atMs))}` : ': respond'
}

export function parseQueueComment(line: string): { position: number; eta: string; model: string } | null {
  const trimmed = line.trim()
  if (!trimmed.startsWith(': queued ')) return null
  const position = /position=(\d+)/.exec(trimmed)?.[1]
  const eta = /eta=(\S+)/.exec(trimmed)?.[1]
  const model = /model=(\S+)/.exec(trimmed)?.[1]
  if (!position || !eta || !model) return null
  return { position: Number(position), eta, model }
}

/** Accepts `: relayed`, `: relayed at_ms=N`, and legacy `: relayed wait_ms=N`. */
export function parseRelayedComment(line: string): { waitMs: number | null; atMs: number | null } | null {
  const trimmed = line.trim()
  if (trimmed !== ': relayed' && !trimmed.startsWith(': relayed ')) return null
  const wait = /wait_ms=(\d+)/.exec(trimmed)?.[1]
  const at = /at_ms=(\d+)/.exec(trimmed)?.[1]
  return {
    waitMs: wait != null ? Number(wait) : null,
    atMs: at != null ? Number(at) : null,
  }
}

export function parseReasonComment(line: string): { atMs: number | null } | null {
  const trimmed = line.trim()
  if (trimmed !== ': reason' && !trimmed.startsWith(': reason ')) return null
  const at = /at_ms=(\d+)/.exec(trimmed)?.[1]
  return { atMs: at != null ? Number(at) : null }
}

export function parseRespondComment(line: string): { atMs: number | null } | null {
  const trimmed = line.trim()
  if (trimmed !== ': respond' && !trimmed.startsWith(': respond ')) return null
  const at = /at_ms=(\d+)/.exec(trimmed)?.[1]
  return { atMs: at != null ? Number(at) : null }
}

export function sendQueueNotice(
  controller: ReadableStreamDefaultController,
  status: QueueStatus,
  model: string,
  requestId: string,
): void {
  const encoder = new TextEncoder()
  const comment = formatQueueComment(status, model, requestId)
  try {
    controller.enqueue(encoder.encode(`${comment}\n\n`))
  } catch {
    // Client disconnected, ignore
  }
}

/**
 * Queued SSE: immediate `: queued` keep-alive, then periodic pings while waiting.
 * Scheduler writes `: relayed` at true backend-dispatch time; this stream then pipes upstream.
 *
 * Clients should treat QUEUE as one-shot (first comment only);
 * later pings are connection keep-alives with updated position/ETA.
 *
 *   : queued position=3 eta=14s model=llama3 request_id=queue_01j5abc
 *   : queued position=2 eta=6s model=llama3 request_id=queue_01j5abc
 *   : relayed
 *   : reason
 *   : respond
 *   data: …
 */
export function createQueuedSseStream(
  scheduler: ModelScheduler,
  entryId: string,
  model: string,
  waitPromise: Promise<Response>,
  pipeOptions: SseProgressPipeOptions = {},
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  const wrapJsonAsSse = pipeOptions.wrapJsonAsSse === true
  let stopped = false
  let pingTimer: ReturnType<typeof setInterval> | null = null
  let controllerRef: ReadableStreamDefaultController<Uint8Array> | null = null
  let upstreamReader: ReadableStreamDefaultReader<Uint8Array> | null = null

  function stopPings() {
    if (pingTimer) {
      clearInterval(pingTimer)
      pingTimer = null
    }
    scheduler.setSseController(entryId, null)
  }

  function sendPing() {
    if (stopped || !controllerRef) return
    const position = scheduler.getQueuePosition(entryId)
    if (position <= 0) {
      stopPings()
      return
    }
    const status = scheduler.getStatus()
    sendQueueNotice(controllerRef, { ...status, position }, model, entryId)
  }

  return new ReadableStream<Uint8Array>({
    start(controller) {
      controllerRef = controller
      scheduler.setSseController(entryId, controller)
      // Immediate first ping so clients see queue status without waiting 5s.
      sendPing()
      pingTimer = setInterval(sendPing, PING_INTERVAL_MS)

      void (async () => {
        try {
          const upstreamResponse = await waitPromise
          stopPings()
          if (stopped) {
            await upstreamResponse.body?.cancel().catch(() => {})
            try {
              controller.close()
            } catch {
              // already closed
            }
            return
          }

          // `: relayed` was already written by the scheduler at true dispatch time.
          await pipeUpstreamToSseController(controller, upstreamResponse, encoder, {
            wrapJsonAsSse,
            stopped: () => stopped,
            setReader: (reader) => {
              upstreamReader = reader
            },
          })
        } catch (err) {
          stopPings()
          if (stopped) {
            try {
              controller.close()
            } catch {
              // already closed
            }
            return
          }
          const message = err instanceof Error ? err.message : String(err)
          const type = message.includes('Queue timeout') ? 'queue_timeout' : 'queue_error'
          const errorData = `data: ${JSON.stringify({ error: { message, type } })}\n\n`
          try {
            controller.enqueue(encoder.encode(errorData))
            controller.close()
          } catch {
            try {
              controller.error(err)
            } catch {
              // already closed
            }
          }
        }
      })()
    },
    cancel() {
      stopped = true
      stopPings()
      scheduler.cancelQueued(entryId)
      void upstreamReader?.cancel().catch(() => {})
    },
  })
}

/**
 * Immediate SSE: commit headers, emit `: relayed`, then start upstream dispatch.
 */
export function createImmediateSseStream(
  startDispatch: (relayedAtMs: number) => Promise<Response>,
  pipeOptions: SseProgressPipeOptions = {},
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  const wrapJsonAsSse = pipeOptions.wrapJsonAsSse === true
  let stopped = false
  let upstreamReader: ReadableStreamDefaultReader<Uint8Array> | null = null

  return new ReadableStream<Uint8Array>({
    start(controller) {
      void (async () => {
        try {
          const relayedAtMs = Date.now()
          controller.enqueue(encoder.encode(`${formatRelayedComment(0)}\n\n`))
          if (stopped) {
            try {
              controller.close()
            } catch {
              // already closed
            }
            return
          }

          const upstreamResponse = await startDispatch(relayedAtMs)
          if (stopped) {
            await upstreamResponse.body?.cancel().catch(() => {})
            try {
              controller.close()
            } catch {
              // already closed
            }
            return
          }

          await pipeUpstreamToSseController(controller, upstreamResponse, encoder, {
            wrapJsonAsSse,
            stopped: () => stopped,
            setReader: (reader) => {
              upstreamReader = reader
            },
          })
        } catch (err) {
          if (stopped) {
            try {
              controller.close()
            } catch {
              // already closed
            }
            return
          }
          try {
            controller.error(err)
          } catch {
            // already closed
          }
        }
      })()
    },
    cancel() {
      stopped = true
      void upstreamReader?.cancel().catch(() => {})
    },
  })
}
