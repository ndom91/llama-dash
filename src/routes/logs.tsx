import { createFileRoute } from '@tanstack/react-router'
import { Eraser } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { PageHeader } from '../components/PageHeader'
import { StatusDot } from '../components/StatusDot'
import { TopBar } from '../components/TopBar'
import type { LogLine } from '../lib/use-llama-swap-logs'
import { useLlamaSwapLogs } from '../lib/use-llama-swap-logs'

export const Route = createFileRoute('/logs')({ component: Logs })

type SourceFilter = 'all' | 'upstream' | 'proxy'

function Logs() {
  const { lines, connected, clear } = useLlamaSwapLogs()
  const [filter, setFilter] = useState<SourceFilter>('all')
  const [autoScroll, setAutoScroll] = useState(true)
  const scrollRef = useRef<HTMLPreElement>(null)

  const filtered = filter === 'all' ? lines : lines.filter((l) => l.source === filter)

  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll on new lines
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [filtered.length, autoScroll])

  const onScroll = () => {
    const el = scrollRef.current
    if (!el) return
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40
    setAutoScroll(atBottom)
  }

  return (
    <div className="main-col">
      <TopBar />
      <div className="content">
        <div className="page">
          <PageHeader
            title="Logs"
            subtitle="live log stream from llama-swap"
            action={
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="topbar-chip" title={connected ? 'Connected' : 'Disconnected'}>
                  <StatusDot tone={connected ? 'ok' : 'err'} live={connected} />
                  <span>{connected ? 'connected' : 'disconnected'}</span>
                </span>
                <button type="button" className="btn btn-ghost btn-xs" onClick={clear}>
                  <Eraser className="icon-btn-12" strokeWidth={2} aria-hidden="true" />
                  clear
                </button>
              </div>
            }
          />

          <section className="panel log-panel">
            <div className="log-toolbar">
              <div className="body-tabs">
                {(['all', 'upstream', 'proxy'] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={`body-tab${filter === s ? ' active' : ''}`}
                    onClick={() => setFilter(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
              <span className="log-count mono">{filtered.length} lines</span>
            </div>
            <pre ref={scrollRef} className="log-pre" onScroll={onScroll}>
              {filtered.length === 0 ? (
                <span className="dim">waiting for log data…</span>
              ) : (
                filtered.map((line) => <LogEntry key={line.id} line={line} />)
              )}
            </pre>
          </section>
        </div>
      </div>
    </div>
  )
}

function LogEntry({ line }: { line: LogLine }) {
  return (
    <span className="log-line">
      <span className={`log-source log-source-${line.source}`}>{line.source === 'upstream' ? 'up' : 'px'}</span>
      {line.text}
      {'\n'}
    </span>
  )
}
