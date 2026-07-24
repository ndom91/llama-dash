import type { ModelScheduler, QueueStatus } from './model-scheduler.ts'

const PING_INTERVAL_MS = 5_000

export function formatQueueComment(status: QueueStatus, model: string, requestId: string): string {
  const eta = status.estimatedEtaMs != null ? `${Math.round(status.estimatedEtaMs / 1000)}s` : '?s'
  return `: queued position=${status.position} eta=${eta} model=${model} request_id=${requestId}`
}

export function sendQueuePing(
  controller: ReadableStreamDefaultController,
  status: QueueStatus,
  model: string,
  requestId: string,
): void {
  const encoder = new TextEncoder()
  const comment = formatQueueComment(status, model, requestId)
  try {
    controller.enqueue(encoder.encode(comment + '\n\n'))
  } catch {
    // Client disconnected, ignore
  }
}

/**
 * Creates a ReadableStream that sends SSE comment pings while waiting for
 * the queue slot, then pipes through the upstream response body.
 *
 * Wire format while waiting:
 *   : queued position=3 eta=14s model=llama3 request_id=queue_01j5abc
 *
 * Once slot acquired:
 *   data: {"id":"chatcmpl-xyz",...}
 *   data: [DONE]
 *
 * Queue timeout/error after headers are committed (status 200): emits a single
 * SSE data event with type queue_timeout / queue_error, then closes. Non-SSE
 * requests still receive HTTP 408 from the handler.
 */
export function createQueuedSseStream(
  scheduler: ModelScheduler,
  entryId: string,
  model: string,
  waitPromise: Promise<Response>,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  let stopped = false
  let started = false
  let pingTimer: ReturnType<typeof setInterval> | null = null
  let controllerRef: ReadableStreamDefaultController | null = null

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
    sendQueuePing(controllerRef, { ...status, position }, model, entryId)
  }

  return new ReadableStream<Uint8Array>({
    start(controller) {
      controllerRef = controller
      scheduler.setSseController(entryId, controller)
      // Immediate first ping so clients see queue status without waiting 5s.
      sendPing()
      pingTimer = setInterval(sendPing, PING_INTERVAL_MS)
    },
    async pull(controller) {
      if (stopped) {
        controller.close()
        return
      }
      // Only the first pull waits for the slot and pipes upstream. Subsequent
      // pulls are no-ops while the first is in flight (body already streaming).
      if (started) return
      started = true

      try {
        const upstreamResponse = await waitPromise
        stopPings()
        stopped = true

        if (!upstreamResponse.body) {
          controller.close()
          return
        }

        const reader = upstreamResponse.body.getReader()
        while (true) {
          const { done, value } = await reader.read()
          if (done) {
            controller.close()
            return
          }
          controller.enqueue(value)
        }
      } catch (err) {
        stopPings()
        stopped = true
        const message = err instanceof Error ? err.message : String(err)
        const type = message.includes('Queue timeout') ? 'queue_timeout' : 'queue_error'
        const errorData = `data: ${JSON.stringify({ error: { message, type } })}\n\n`
        controller.enqueue(encoder.encode(errorData))
        controller.close()
      }
    },
    cancel() {
      stopPings()
      stopped = true
    },
  })
}
