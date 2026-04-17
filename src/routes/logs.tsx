import { useVirtualizer } from '@tanstack/react-virtual'
import { createFileRoute } from '@tanstack/react-router'
import { Eraser, WrapText } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { PageHeader } from '../components/PageHeader'
import { StatusDot } from '../components/StatusDot'
import { TopBar } from '../components/TopBar'
import { useLlamaSwapLogs } from '../lib/use-llama-swap-logs'

export const Route = createFileRoute('/logs')({ component: Logs })

type SourceFilter = 'all' | 'upstream' | 'proxy'

function Logs() {
  const { lines, connected, clear } = useLlamaSwapLogs()
  const [filter, setFilter] = useState<SourceFilter>('all')
  const [autoScroll, setAutoScroll] = useState(true)
  const [wrap, setWrap] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const filtered = filter === 'all' ? lines : lines.filter((l) => l.source === filter)
  const maxWidthRef = useRef(0)
  const virtualContainerRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 20,
    overscan: 40,
  })

  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll on new lines
  useEffect(() => {
    if (autoScroll && filtered.length > 0) {
      virtualizer.scrollToIndex(filtered.length - 1, { align: 'end' })
    }
  }, [filtered.length, autoScroll])

  const measureRow = useCallback(
    (el: HTMLElement | null) => {
      if (!el) return
      virtualizer.measureElement(el)
      if (!wrap) {
        const w = el.scrollWidth
        if (w > maxWidthRef.current) {
          maxWidthRef.current = w
          if (virtualContainerRef.current) {
            virtualContainerRef.current.style.width = `${w}px`
          }
        }
      }
    },
    [virtualizer, wrap],
  )

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
                <button
                  type="button"
                  className="btn btn-ghost btn-xs"
                  onClick={() => {
                    clear()
                    maxWidthRef.current = 0
                    if (virtualContainerRef.current) virtualContainerRef.current.style.width = ''
                  }}
                >
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
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  type="button"
                  className={`btn btn-ghost btn-xs${wrap ? ' btn-active' : ''}`}
                  onClick={() => setWrap(!wrap)}
                  title={wrap ? 'Disable line wrap' : 'Enable line wrap'}
                >
                  <WrapText className="icon-btn-12" strokeWidth={2} aria-hidden="true" />
                  wrap
                </button>
                <span className="log-count mono">{filtered.length} lines</span>
              </div>
            </div>
            <div ref={scrollRef} className="log-scroll" onScroll={onScroll}>
              {filtered.length === 0 ? (
                <div className="log-empty dim">waiting for log data…</div>
              ) : (
                <div ref={virtualContainerRef} className="log-virtual" style={{ height: virtualizer.getTotalSize() }}>
                  {virtualizer.getVirtualItems().map((vi) => {
                    const line = filtered[vi.index]
                    return (
                      <div
                        key={line.id}
                        className={`log-line${wrap ? ' log-line-wrap' : ''}`}
                        data-index={vi.index}
                        ref={measureRow}
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          minWidth: '100%',
                          transform: `translateY(${vi.start}px)`,
                        }}
                      >
                        <span className={`log-source log-source-${line.source}`}>
                          {line.source === 'upstream' ? 'up' : 'px'}
                        </span>
                        {line.text}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
