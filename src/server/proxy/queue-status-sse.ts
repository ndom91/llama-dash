import type { ModelScheduler, QueueStatus } from './model-scheduler.ts'

export const QUEUE_MS_HEADER = 'x-llama-dash-queue-ms'

/** Keep-alive interval for queued SSE clients. */
const PING_INTERVAL_MS = 5_000

export function formatQueueComment(status: QueueStatus, model: string, requestId: string): string {
  const eta = status.estimatedEtaMs != null ? `${Math.round(status.estimatedEtaMs / 1000)}s` : '?s'
  return `: queued position=${status.position} eta=${eta} model=${model} request_id=${requestId}`
}

/** RELAY marker: queue done + dispatched to backend. No wait_ms payload. */
export function formatRelayedComment(): string {
  return ': relayed'
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

/** Accepts `: relayed` and legacy `: relayed wait_ms=N`. */
export function parseRelayedComment(line: string): { waitMs: number | null } | null {
  const trimmed = line.trim()
  if (trimmed !== ': relayed' && !trimmed.startsWith(': relayed ')) return null
  const wait = /wait_ms=(\d+)/.exec(trimmed)?.[1]
  return { waitMs: wait != null ? Number(wait) : null }
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
 * Playground / inspector clients should treat QUEUE as one-shot (first comment only);
 * later pings are connection keep-alives with updated position/ETA.
 *
 *   : queued position=3 eta=14s model=llama3 request_id=queue_01j5abc
 *   : queued position=2 eta=6s model=llama3 request_id=queue_01j5abc
 *   : relayed
 *   data: …
 */
export function createQueuedSseStream(
  scheduler: ModelScheduler,
  entryId: string,
  model: string,
  waitPromise: Promise<Response>,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
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

          if (!upstreamResponse.body) {
            controller.close()
            return
          }

          upstreamReader = upstreamResponse.body.getReader()
          while (!stopped) {
            const { done, value } = await upstreamReader.read()
            if (done) {
              controller.close()
              return
            }
            controller.enqueue(value)
          }
          await upstreamReader.cancel().catch(() => {})
          try {
            controller.close()
          } catch {
            // already closed
          }
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
export function createImmediateSseStream(startDispatch: () => Promise<Response>): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  let stopped = false
  let upstreamReader: ReadableStreamDefaultReader<Uint8Array> | null = null

  return new ReadableStream<Uint8Array>({
    start(controller) {
      void (async () => {
        try {
          controller.enqueue(encoder.encode(`${formatRelayedComment()}\n\n`))
          if (stopped) {
            try {
              controller.close()
            } catch {
              // already closed
            }
            return
          }

          const upstreamResponse = await startDispatch()
          if (stopped) {
            await upstreamResponse.body?.cancel().catch(() => {})
            try {
              controller.close()
            } catch {
              // already closed
            }
            return
          }

          if (!upstreamResponse.body) {
            controller.close()
            return
          }

          upstreamReader = upstreamResponse.body.getReader()
          while (!stopped) {
            const { done, value } = await upstreamReader.read()
            if (done) {
              controller.close()
              return
            }
            controller.enqueue(value)
          }
          await upstreamReader.cancel().catch(() => {})
          try {
            controller.close()
          } catch {
            // already closed
          }
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
