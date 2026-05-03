import { useVirtualizer } from '@tanstack/react-virtual'
import { Eraser, Search, WrapText } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { PageHeader } from '../../components/PageHeader'
import { StatusDot } from '../../components/StatusDot'
import { TopBar } from '../../components/TopBar'
import { cn } from '../../lib/cn'
import { useSystemStatus } from '../../lib/queries'
import { useLlamaSwapLogs } from '../../lib/use-llama-swap-logs'
import { HighlightedText } from './HighlightedText'

type SourceFilter = 'all' | 'upstream' | 'proxy'

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function LogsPage() {
  const { data: system } = useSystemStatus()

  if (system?.inference.capabilities.logs === false) {
    return (
      <div className="main-col">
        <TopBar />
        <div className="content">
          <div className="page min-h-full flex-1 bg-surface-1">
            <PageHeader
              kicker="log · stream"
              title="Logs"
              subtitle={`${system.inference.label} does not expose runtime logs through llama-dash.`}
              variant="integrated"
            />
            <div className="empty-state px-6 max-md:px-3">
              The active inference backend does not support live log streaming yet.
            </div>
          </div>
        </div>
      </div>
    )
  }

  return <LlamaSwapLogsPage />
}

function LlamaSwapLogsPage() {
  const { lines, connected, clear } = useLlamaSwapLogs()
  const [filter, setFilter] = useState<SourceFilter>('all')
  const [autoScroll, setAutoScroll] = useState(true)
  const [wrap, setWrap] = useState(true)
  const [search, setSearch] = useState('')
  const [useRegex, setUseRegex] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const maxWidthRef = useRef(0)
  const virtualContainerRef = useRef<HTMLDivElement>(null)

  const sourceFiltered = filter === 'all' ? lines : lines.filter((l) => l.source === filter)

  const searchRe = useMemo(() => {
    if (!search) return null
    try {
      return useRegex ? new RegExp(search, 'gi') : new RegExp(escapeRegex(search), 'gi')
    } catch {
      return null
    }
  }, [search, useRegex])

  const filtered = useMemo(() => {
    if (!searchRe) return sourceFiltered
    return sourceFiltered.filter((l) => {
      searchRe.lastIndex = 0
      return searchRe.test(l.text)
    })
  }, [sourceFiltered, searchRe])

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

  // biome-ignore lint/correctness/useExhaustiveDependencies: remeasure all rows when wrap toggles
  useEffect(() => {
    if (wrap) resetWidth()
    virtualizer.measure()
  }, [wrap])

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

  const resetWidth = () => {
    maxWidthRef.current = 0
    if (virtualContainerRef.current) virtualContainerRef.current.style.width = ''
  }

  return (
    <div className="main-col">
      <TopBar />
      <div className="content">
        <div className="page min-h-full flex-1 bg-surface-1">
          <PageHeader
            kicker="log · stream"
            title="Logs"
            subtitle="live output from llama-swap"
            variant="integrated"
            action={
              <div className="flex items-center gap-2">
                <span
                  className="inline-flex items-center gap-1.5 font-mono text-[11px] text-ok"
                  title={connected ? 'Connected' : 'Disconnected'}
                >
                  <StatusDot tone={connected ? 'ok' : 'err'} live={connected} />
                  <span>{connected ? 'connected' : 'disconnected'}</span>
                </span>
                <button
                  type="button"
                  className="btn btn-ghost btn-xs min-w-[52px] justify-center"
                  onClick={() => {
                    clear()
                    resetWidth()
                  }}
                >
                  <Eraser className="icon-btn-12" strokeWidth={2} aria-hidden="true" />
                  clear
                </button>
              </div>
            }
          />

          <section className="panel !rounded-none !border-x-0 !bg-surface-1 flex min-h-0 flex-1 flex-col">
            <div className="flex shrink-0 items-center justify-between border-b border-border bg-surface-1 px-[18px] max-md:flex-wrap max-md:px-3">
              <div className="inline-flex h-12 items-stretch overflow-hidden border-x border-border divide-x divide-border">
                {(['all', 'upstream', 'proxy'] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={`inline-flex h-full items-center justify-center px-2.5 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] transition-colors ${
                      filter === s ? 'bg-surface-4 text-accent' : 'text-fg-dim hover:bg-surface-3 hover:text-fg'
                    }`}
                    onClick={() => setFilter(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 max-md:w-full max-md:flex-wrap">
                <div className="flex h-7 items-center gap-1 rounded-sm border border-border bg-surface-2 px-1.5 focus-within:border-accent">
                  <Search className="h-3 w-3 shrink-0 text-fg-dim" strokeWidth={2} aria-hidden="true" />
                  <input
                    id="log-filter"
                    type="text"
                    className="w-[180px] border-none bg-transparent p-0 font-mono text-[11px] text-fg outline-none focus:outline-none focus-visible:outline-none"
                    placeholder="filter…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    spellCheck={false}
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    className={
                      useRegex
                        ? 'rounded-sm bg-surface-4 px-1.5 py-px font-mono text-[10px] font-semibold text-accent'
                        : 'rounded-sm bg-transparent px-1.5 py-px font-mono text-[10px] font-semibold text-fg-dim hover:bg-surface-4 hover:text-fg-muted'
                    }
                    onClick={() => setUseRegex(!useRegex)}
                    title={useRegex ? 'Switch to substring' : 'Switch to regex'}
                  >
                    .*
                  </button>
                </div>
                <button
                  type="button"
                  className={
                    wrap
                      ? 'btn btn-ghost btn-xs min-w-[64px] justify-center btn-active'
                      : 'btn btn-ghost btn-xs min-w-[64px] justify-center'
                  }
                  onClick={() => setWrap(!wrap)}
                  title={wrap ? 'Disable line wrap' : 'Enable line wrap'}
                >
                  <WrapText className="icon-btn-12" strokeWidth={2} aria-hidden="true" />
                  wrap
                </button>
                <span className="mono text-[11px] text-fg-dim">{filtered.length} lines</span>
              </div>
            </div>
            <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto bg-surface-1" onScroll={onScroll}>
              {filtered.length === 0 ? (
                <div className="px-6 py-2.5 font-mono text-[11.5px] text-fg-dim max-md:px-3">
                  {search ? 'no matches' : 'waiting for log data…'}
                </div>
              ) : (
                <div
                  ref={virtualContainerRef}
                  className="relative min-w-full"
                  style={{ height: virtualizer.getTotalSize() }}
                >
                  {virtualizer.getVirtualItems().map((vi) => {
                    const line = filtered[vi.index]
                    return (
                      <div
                        key={line.id}
                        className="flex items-start px-3.5 font-mono text-[11.5px] leading-5 text-fg-muted hover:bg-surface-3 max-md:px-3"
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
                        <span
                          className={
                            line.source === 'upstream'
                              ? 'mr-2 inline-block w-[22px] shrink-0 text-right text-[10px] font-semibold uppercase tracking-[0.04em] text-info'
                              : 'mr-2 inline-block w-[22px] shrink-0 text-right text-[10px] font-semibold uppercase tracking-[0.04em] text-accent'
                          }
                        >
                          {line.source === 'upstream' ? 'up' : 'px'}
                        </span>
                        <span
                          className={cn(
                            'block',
                            wrap
                              ? 'min-w-0 flex-1 whitespace-pre-wrap [overflow-wrap:anywhere]'
                              : 'min-w-max flex-none whitespace-pre',
                          )}
                        >
                          <HighlightedText text={line.text} pattern={searchRe} />
                        </span>
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
