import { useVirtualizer } from '@tanstack/react-virtual'
import { createFileRoute } from '@tanstack/react-router'
import { Eraser, Search, WrapText } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { PageHeader } from '../components/PageHeader'
import { StatusDot } from '../components/StatusDot'
import { TopBar } from '../components/TopBar'
import { useLlamaSwapLogs } from '../lib/use-llama-swap-logs'

export const Route = createFileRoute('/logs')({ component: Logs })

type SourceFilter = 'all' | 'upstream' | 'proxy'

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function Logs() {
  const { lines, connected, clear } = useLlamaSwapLogs()
  const [filter, setFilter] = useState<SourceFilter>('all')
  const [autoScroll, setAutoScroll] = useState(true)
  const [wrap, setWrap] = useState(false)
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
        <div className="page logs-page">
          <PageHeader
            kicker="log · stream"
            title="Logs"
            subtitle="live output from llama-swap"
            variant="integrated"
            action={
              <div className="logs-header-actions">
                <span className="logs-connection-badge" title={connected ? 'Connected' : 'Disconnected'}>
                  <StatusDot tone={connected ? 'ok' : 'err'} live={connected} />
                  <span>{connected ? 'connected' : 'disconnected'}</span>
                </span>
                <button
                  type="button"
                  className="btn btn-ghost btn-xs logs-clear-btn"
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

          <section className="panel log-panel logs-panel">
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
              <div className="logs-toolbar-actions">
                <div className="log-search">
                  <Search className="log-search-icon" strokeWidth={2} aria-hidden="true" />
                  <input
                    id="log-filter"
                    type="text"
                    className="log-search-input"
                    placeholder="filter…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    spellCheck={false}
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    className={`log-search-regex${useRegex ? ' active' : ''}`}
                    onClick={() => setUseRegex(!useRegex)}
                    title={useRegex ? 'Switch to substring' : 'Switch to regex'}
                  >
                    .*
                  </button>
                </div>
                <button
                  type="button"
                  className={`btn btn-ghost btn-xs log-wrap-btn${wrap ? ' btn-active' : ''}`}
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
                <div className="log-empty dim">{search ? 'no matches' : 'waiting for log data…'}</div>
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
                        <HighlightedText text={line.text} pattern={searchRe} />
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

function HighlightedText({ text, pattern }: { text: string; pattern: RegExp | null }) {
  if (!pattern) return <>{text}</>

  const parts: Array<{ text: string; match: boolean; offset: number }> = []
  let lastIndex = 0
  pattern.lastIndex = 0
  for (let m = pattern.exec(text); m !== null; m = pattern.exec(text)) {
    if (m.index > lastIndex) parts.push({ text: text.slice(lastIndex, m.index), match: false, offset: lastIndex })
    parts.push({ text: m[0], match: true, offset: m.index })
    lastIndex = pattern.lastIndex
    if (m[0].length === 0) {
      pattern.lastIndex++
      if (pattern.lastIndex > text.length) break
    }
  }
  if (lastIndex < text.length) parts.push({ text: text.slice(lastIndex), match: false, offset: lastIndex })
  if (parts.length === 0) return <>{text}</>

  return (
    <>
      {parts.map((p) =>
        p.match ? (
          <mark key={p.offset} className="log-match">
            {p.text}
          </mark>
        ) : (
          p.text
        ),
      )}
    </>
  )
}
