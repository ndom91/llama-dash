import { config } from '../config.ts'

const MIN_RETRY_MS = 1_000
const MAX_RETRY_MS = 30_000

/**
 * Reads the paused flag from one llama-swap `/api/events` SSE block. llama-swap
 * (v268+) wraps it as `{"type":"pauseChanged","data":"{\"paused\":true}"}`.
 * Returns null for any other event.
 */
export function parsePauseEvent(block: string): boolean | null {
  for (const line of block.split('\n')) {
    if (!line.startsWith('data:')) continue
    try {
      const envelope = JSON.parse(line.slice('data:'.length))
      if (envelope?.type !== 'pauseChanged' || typeof envelope.data !== 'string') return null
      const data = JSON.parse(envelope.data)
      return typeof data?.paused === 'boolean' ? data.paused : null
    } catch {
      return null
    }
  }
  return null
}

/**
 * Follows llama-swap's dashboard event stream, because that is the only place
 * it reports the pause state. Reports null while disconnected, since the state
 * is then unknown. llama-swap sends the current state on every connect.
 */
export function watchLlamaSwapPauseState(onChange: (paused: boolean | null) => void): void {
  void runWatcher(onChange)
}

async function runWatcher(onChange: (paused: boolean | null) => void) {
  let retryMs = MIN_RETRY_MS
  for (;;) {
    try {
      const res = await fetch(`${config.inferenceBaseUrl}/api/events`, {
        headers: { accept: 'text/event-stream' },
      })
      if (!res.ok || !res.body) throw new Error(`llama-swap /api/events -> ${res.status}`)
      retryMs = MIN_RETRY_MS

      const decoder = new TextDecoder()
      let buffer = ''
      for await (const chunk of res.body) {
        buffer += decoder.decode(chunk, { stream: true })
        let boundary = buffer.indexOf('\n\n')
        while (boundary >= 0) {
          const paused = parsePauseEvent(buffer.slice(0, boundary))
          if (paused !== null) onChange(paused)
          buffer = buffer.slice(boundary + 2)
          boundary = buffer.indexOf('\n\n')
        }
      }
    } catch {
      // Reconnect below. The stream also ends whenever llama-swap restarts.
    }
    onChange(null)
    await new Promise((resolve) => setTimeout(resolve, retryMs))
    retryMs = Math.min(retryMs * 2, MAX_RETRY_MS)
  }
}
