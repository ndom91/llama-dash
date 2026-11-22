import { useCallback, useEffect, useState } from 'react'
import { parseLogTimestamp } from './log-timestamps'

export type LogLine = {
  id: number
  source: 'upstream' | 'proxy'
  text: string
  ts: number | null
  isReceiptTime: boolean
}

const MAX_LINES = 10_000
let nextId = 0

export function useLlamaSwapLogs() {
  const [lines, setLines] = useState<LogLine[]>([])
  const [connected, setConnected] = useState(false)

  const clear = useCallback(() => {
    setLines([])
  }, [])

  useEffect(() => {
    const es = new EventSource('/api/log-events')
    const seenSources = new Set<LogLine['source']>()

    es.onopen = () => {
      // Reconnects replay history again; don't append it to the previous stream.
      seenSources.clear()
      setLines([])
      setConnected(true)
    }
    es.onerror = () => setConnected(false)

    es.onmessage = (ev) => {
      try {
        const envelope = JSON.parse(ev.data)
        if (envelope.type !== 'logData') return

        const logData = typeof envelope.data === 'string' ? JSON.parse(envelope.data) : envelope.data
        const source: 'upstream' | 'proxy' = logData.source === 'proxy' ? 'proxy' : 'upstream'
        const raw: unknown = logData.data
        if (typeof raw !== 'string' || !raw) return

        // llama-swap replays each source's history in its first batch. There is
        // no explicit history marker, so conservatively leave that batch untimed
        // even when the source was empty and its first batch is actually live.
        const receivedAt = seenSources.has(source) ? Date.now() : null
        seenSources.add(source)
        const newLines = raw
          .split('\n')
          .filter((t: string) => t.length > 0)
          .map((text: string) => {
            const ts = parseLogTimestamp(text).ts
            return {
              id: nextId++,
              source,
              text,
              ts: ts ?? receivedAt,
              isReceiptTime: ts === null && receivedAt !== null,
            }
          })
        if (newLines.length === 0) return

        setLines((prev) => {
          const next = [...prev, ...newLines]
          return next.length > MAX_LINES ? next.slice(next.length - MAX_LINES) : next
        })
      } catch {
        // malformed SSE event
      }
    }

    return () => {
      es.close()
      setConnected(false)
    }
  }, [])

  return { lines, connected, clear }
}
