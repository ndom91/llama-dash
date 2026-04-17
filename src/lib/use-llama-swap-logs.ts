import { useCallback, useEffect, useState } from 'react'

export type LogLine = {
  id: number
  source: 'upstream' | 'proxy'
  text: string
  ts: number
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
    const es = new EventSource('/api/events')

    es.onopen = () => setConnected(true)
    es.onerror = () => setConnected(false)

    es.onmessage = (ev) => {
      try {
        const envelope = JSON.parse(ev.data)
        if (envelope.type !== 'logData') return

        const logData = typeof envelope.data === 'string' ? JSON.parse(envelope.data) : envelope.data
        const source: 'upstream' | 'proxy' = logData.source === 'proxy' ? 'proxy' : 'upstream'
        const raw: string = logData.data ?? ''
        if (!raw) return

        const ts = Date.now()
        const newLines = raw
          .split('\n')
          .filter((t: string) => t.length > 0)
          .map((text: string) => ({ id: nextId++, source, text, ts }) as LogLine)
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
