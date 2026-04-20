import { useVirtualizer } from '@tanstack/react-virtual'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { ArrowDown, ArrowUp, Download, RefreshCw, Search, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { cn } from '../lib/cn'
import { DurationBar } from '../components/DurationBar'
import { PageHeader } from '../components/PageHeader'
import { StatusCell } from '../components/StatusCell'
import { StatusDot } from '../components/StatusDot'
import { Tooltip } from '../components/Tooltip'
import { TopBar } from '../components/TopBar'
import type { ApiHistogramBucket, ApiRequest } from '../lib/api'
import { useRequestHistogram, useRequestsList } from '../lib/queries'

type RequestsSearch = { model?: string }

export const Route = createFileRoute('/requests/')({
  component: Requests,
  validateSearch: (search: Record<string, unknown>): RequestsSearch => ({
    model: typeof search.model === 'string' ? search.model : undefined,
  }),
})

const ROW_HEIGHT = 37
const COL_WIDTHS = [100, '22%', '28%', 70, 80, 80, 110] as const

function VtColgroup() {
  return (
    <colgroup>
      {COL_WIDTHS.map((w, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static column list
        <col key={i} style={{ width: w }} />
      ))}
    </colgroup>
  )
}

type SortKey = 'startedAt' | 'durationMs' | 'statusCode' | 'totalTokens'
type SortDir = 'asc' | 'desc'
type StatusFilter = 'all' | 'ok' | 'err'

function Requests() {
  const navigate = useNavigate()
  const { model: modelParam } = Route.useSearch()
  const { data, error, isLoading, isRefetching, refetch, hasNextPage, fetchNextPage, isFetchingNextPage } =
    useRequestsList()
  const { data: histogram } = useRequestHistogram()

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [modelFilter, setModelFilter] = useState<string>(modelParam ?? 'all')
  const [sortKey, setSortKey] = useState<SortKey>('startedAt')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [keyFilter, setKeyFilter] = useState<string>('all')
  const [selectedIdx, setSelectedIdx] = useState(-1)
  const searchRef = useRef<HTMLInputElement>(null)

  const allRows = useMemo(() => data?.pages.flatMap((p) => p.requests) ?? [], [data])

  const models = useMemo(() => {
    const set = new Set<string>()
    for (const r of allRows) if (r.model) set.add(r.model)
    return Array.from(set).sort()
  }, [allRows])

  const keyNames = useMemo(() => {
    const set = new Set<string>()
    for (const r of allRows) if (r.keyName) set.add(r.keyName)
    return Array.from(set).sort()
  }, [allRows])

  useEffect(() => {
    if (modelFilter === 'all' || !modelParam || models.length === 0) return
    if (models.includes(modelFilter)) return
    const match = models.find((m) => m === modelParam || m.endsWith(`/${modelParam}`))
    if (match) setModelFilter(match)
  }, [models, modelFilter, modelParam])

  const filtered = useMemo(() => {
    let out = allRows

    if (statusFilter === 'ok') out = out.filter((r) => r.statusCode >= 200 && r.statusCode < 400)
    else if (statusFilter === 'err') out = out.filter((r) => r.statusCode >= 400)

    if (modelFilter !== 'all') out = out.filter((r) => r.model === modelFilter)

    if (keyFilter !== 'all') {
      if (keyFilter === '__none__') out = out.filter((r) => r.keyName == null)
      else out = out.filter((r) => r.keyName === keyFilter)
    }

    if (search) {
      const q = search.toLowerCase()
      out = out.filter(
        (r) =>
          r.endpoint.toLowerCase().includes(q) ||
          r.method.toLowerCase().includes(q) ||
          (r.model?.toLowerCase().includes(q) ?? false) ||
          String(r.statusCode).includes(q),
      )
    }

    return out
  }, [allRows, statusFilter, modelFilter, keyFilter, search])

  const rows = useMemo(() => {
    const sorted = [...filtered]
    const dir = sortDir === 'asc' ? 1 : -1
    sorted.sort((a, b) => {
      const av = sortVal(a, sortKey)
      const bv = sortVal(b, sortKey)
      if (av < bv) return -1 * dir
      if (av > bv) return 1 * dir
      return 0
    })
    return sorted
  }, [filtered, sortKey, sortDir])

  const errCount = useMemo(() => filtered.filter((r) => r.statusCode >= 400).length, [filtered])
  const maxDuration = useMemo(() => Math.max(0, ...rows.map((r) => r.durationMs)), [rows])
  const scrollRef = useRef<HTMLDivElement>(null)

  const fetchNextRef = useRef({ hasNextPage, isFetchingNextPage, fetchNextPage, rowCount: rows.length })
  fetchNextRef.current = { hasNextPage, isFetchingNextPage, fetchNextPage, rowCount: rows.length }

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 20,
    onChange: (v) => {
      const last = v.getVirtualItems().at(-1)
      if (!last) return
      const { hasNextPage, isFetchingNextPage, fetchNextPage, rowCount } = fetchNextRef.current
      if (last.index >= rowCount - 20 && hasNextPage && !isFetchingNextPage) {
        fetchNextPage()
      }
    },
  })

  useEffect(() => {
    if (selectedIdx >= 0) virtualizer.scrollToIndex(selectedIdx, { align: 'auto' })
  }, [selectedIdx, virtualizer])

  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') {
        setSelectedIdx(-1)
        if (e.key === 'Escape') (e.target as HTMLElement).blur()
        return
      }

      if (e.key === '/' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault()
        searchRef.current?.focus()
        return
      }

      if (rows.length === 0) return

      if (e.key === 'ArrowDown' || e.key === 'j') {
        e.preventDefault()
        setSelectedIdx((i) => Math.min(i + 1, rows.length - 1))
      } else if (e.key === 'ArrowUp' || e.key === 'k') {
        e.preventDefault()
        setSelectedIdx((i) => Math.max(i - 1, 0))
      } else if (e.key === 'Enter' && selectedIdx >= 0 && selectedIdx < rows.length) {
        e.preventDefault()
        navigate({ to: '/requests/$id', params: { id: rows[selectedIdx].id } })
      }
    },
    [rows, selectedIdx, navigate],
  )

  useEffect(() => {
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onKeyDown])

  useEffect(() => {
    const clearSelection = () => setSelectedIdx(-1)
    window.addEventListener('blur', clearSelection)
    return () => window.removeEventListener('blur', clearSelection)
  }, [])

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortKey(key)
      setSortDir(key === 'startedAt' ? 'desc' : 'asc')
    }
  }

  const hasFilters = search !== '' || statusFilter !== 'all' || modelFilter !== 'all' || keyFilter !== 'all'

  return (
    <div className="main-col">
      <TopBar actions={null} />
      <div className="content">
        <div className="page requests-page">
          <PageHeader
            kicker="req · log"
            title="Request log"
            subtitle="proxied API calls, newest first"
            variant="integrated"
            action={
              <div className="requests-header-actions">
                <span className="live-badge requests-live-badge">
                  <StatusDot tone="ok" live />
                  live
                </span>
                <Tooltip label="Export">
                  <button type="button" className="btn btn-ghost btn-icon" disabled aria-label="Export">
                    <Download className="icon-14" strokeWidth={1.75} aria-hidden="true" />
                  </button>
                </Tooltip>
                <Tooltip label="Refresh">
                  <button
                    type="button"
                    className="btn btn-ghost btn-icon"
                    onClick={() => refetch()}
                    disabled={isRefetching}
                    aria-label="Refresh"
                  >
                    <RefreshCw
                      className={`icon-14${isRefetching ? ' animate-spin' : ''}`}
                      strokeWidth={1.75}
                      aria-hidden="true"
                    />
                  </button>
                </Tooltip>
              </div>
            }
          />

          {error ? <div className="err-banner requests-error-banner">{error.message}</div> : null}

          <div className="requests-shell">
            <aside className="requests-filters-panel">
              <div className="requests-filter-section">
                <div className="requests-filter-label">Search</div>
                <div className="search-box requests-search-box">
                  <Search className="search-icon" size={14} strokeWidth={2} aria-hidden="true" />
                  <input
                    ref={searchRef}
                    type="text"
                    className="search-input requests-search-input"
                    placeholder="endpoint, model, status"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                  {!search ? <span className="requests-search-shortcut">/</span> : null}
                  {search ? (
                    <button
                      type="button"
                      className="search-clear"
                      onClick={() => setSearch('')}
                      aria-label="Clear search"
                    >
                      <X size={12} strokeWidth={2} />
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="requests-filter-section">
                <div className="requests-filter-label">Status</div>
                <select
                  className="filter-select requests-filter-select"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                >
                  <option value="all">All status</option>
                  <option value="ok">Success</option>
                  <option value="err">Errors</option>
                </select>
              </div>

              <div className="requests-filter-section">
                <div className="requests-filter-label">Model</div>
                <select
                  className="filter-select requests-filter-select"
                  value={modelFilter}
                  onChange={(e) => setModelFilter(e.target.value)}
                >
                  <option value="all">All models</option>
                  {models.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              <div className="requests-filter-section">
                <div className="requests-filter-label">Key</div>
                <select
                  className="filter-select requests-filter-select"
                  value={keyFilter}
                  onChange={(e) => setKeyFilter(e.target.value)}
                >
                  <option value="all">All keys</option>
                  <option value="__none__">No key</option>
                  {keyNames.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
              </div>

              {hasFilters ? (
                <button
                  type="button"
                  className="btn btn-ghost btn-xs requests-clear-btn"
                  onClick={() => {
                    setSearch('')
                    setStatusFilter('all')
                    setModelFilter('all')
                    setKeyFilter('all')
                  }}
                >
                  Clear filters
                </button>
              ) : null}
            </aside>

            <div className="requests-body">
              {histogram && histogram.length > 0 ? (
                <section className="panel requests-panel requests-histogram-panel">
                  <div className="histogram-header requests-panel-head">
                    <div>
                      <span className="panel-title">req/s</span>
                      <span className="panel-sub" style={{ marginLeft: 8 }}>
                        last 60m · bucket 1m
                      </span>
                    </div>
                  </div>
                  <Histogram buckets={histogram} />
                  <div className="histogram-labels requests-histogram-labels">
                    <span>-60m</span>
                    <span>-40m</span>
                    <span>-20m</span>
                    <span>now</span>
                  </div>
                </section>
              ) : null}

              <section className="panel requests-panel requests-log-panel">
                <div className="panel-head requests-panel-head">
                  <span className="panel-title">Log</span>
                  <span className="panel-sub">
                    {filtered.length} rows{errCount > 0 ? ` · ${errCount} errors` : ''}
                  </span>
                  <span className="requests-panel-hint">↑↓ navigate · ⏎ open · / search</span>
                </div>
                {isLoading ? (
                  <div className="empty-state requests-empty-state">loading…</div>
                ) : rows.length === 0 ? (
                  <div className="empty-state requests-empty-state">
                    {hasFilters ? (
                      'no requests match filters'
                    ) : (
                      <>
                        no requests yet. call <code translate="no">/v1/*</code> to populate.
                      </>
                    )}
                  </div>
                ) : (
                  <div className="dtable-virtual-wrap requests-table-wrap">
                    <table className="dtable dtable-virtual requests-table">
                      <VtColgroup />
                      <thead>
                        <tr>
                          <SortTh
                            field="startedAt"
                            current={sortKey}
                            dir={sortDir}
                            onToggle={toggleSort}
                            className="mono"
                          >
                            t
                          </SortTh>
                          <th className="mono">endpoint</th>
                          <th>model</th>
                          <SortTh field="statusCode" current={sortKey} dir={sortDir} onToggle={toggleSort}>
                            status
                          </SortTh>
                          <SortTh
                            field="totalTokens"
                            current={sortKey}
                            dir={sortDir}
                            onToggle={toggleSort}
                            className="num"
                          >
                            tok-in
                          </SortTh>
                          <th className="num">tok-out</th>
                          <SortTh
                            field="durationMs"
                            current={sortKey}
                            dir={sortDir}
                            onToggle={toggleSort}
                            className="num"
                          >
                            duration
                          </SortTh>
                        </tr>
                      </thead>
                    </table>
                    <div ref={scrollRef} className="dtable-virtual-body requests-table-body">
                      <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
                        {virtualizer.getVirtualItems().map((vRow) => {
                          const r = rows[vRow.index]
                          return (
                            // biome-ignore lint/a11y/noStaticElementInteractions: virtual row wrapper, keyboard nav handled globally
                            <div
                              key={r.id}
                              tabIndex={-1}
                              className={cn('vt-row clickable-row', vRow.index === selectedIdx && 'selected-row')}
                              style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                width: '100%',
                                height: ROW_HEIGHT,
                                transform: `translateY(${vRow.start}px)`,
                              }}
                              onClick={() => navigate({ to: '/requests/$id', params: { id: r.id } })}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') navigate({ to: '/requests/$id', params: { id: r.id } })
                              }}
                            >
                              <table className="dtable dtable-virtual requests-table">
                                <VtColgroup />
                                <tbody>
                                  <tr>
                                    <td className="mono dim" style={{ whiteSpace: 'nowrap' }}>
                                      {formatWhen(r.startedAt)}
                                    </td>
                                    <td className="mono" translate="no">
                                      {r.endpoint}
                                    </td>
                                    <td
                                      className="dim"
                                      style={{
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                      }}
                                      translate="no"
                                    >
                                      {r.model ?? '—'}
                                    </td>
                                    <td>
                                      <StatusCell code={r.statusCode} streamed={r.streamed} />
                                    </td>
                                    <td className="num dim">{r.promptTokens ?? '—'}</td>
                                    <td className="num">{r.completionTokens ?? '—'}</td>
                                    <td>
                                      <DurationBar ms={r.durationMs} maxMs={maxDuration} isErr={r.statusCode >= 400} />
                                    </td>
                                  </tr>
                                </tbody>
                              </table>
                            </div>
                          )
                        })}
                      </div>
                      {isFetchingNextPage ? (
                        <div className="empty-state requests-empty-state" style={{ paddingBlock: 8 }}>
                          loading more…
                        </div>
                      ) : null}
                    </div>
                  </div>
                )}
              </section>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Histogram({ buckets }: { buckets: Array<ApiHistogramBucket> }) {
  const maxTotal = useMemo(() => {
    const peak = Math.max(...buckets.map((b) => b.total))
    return Math.max(Math.ceil(peak * 1.1), 5)
  }, [buckets])

  return (
    <div className="histogram">
      {buckets.map((b) => {
        const ok = b.total - b.errors
        const barPx = 72
        const okH = ok > 0 ? Math.max(Math.sqrt(ok / maxTotal) * barPx, 3) : 2
        const errH = b.errors > 0 ? Math.max(Math.sqrt(b.errors / maxTotal) * barPx, 3) : 0
        const empty = b.total === 0
        const time = new Date(b.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        const errSuffix = b.errors ? ` (${b.errors} err)` : ''
        const label = empty ? time : `${time} · ${b.total}${errSuffix}`
        return (
          <div key={b.timestamp} className="histogram-bar">
            <Tooltip label={label} side="top">
              <div className="histogram-bar-inner">
                {errH > 0 ? <div className="histogram-bar-err" style={{ height: errH }} /> : null}
                {okH > 0 ? (
                  <div className="histogram-bar-ok" style={{ height: okH, opacity: empty ? 0.15 : undefined }} />
                ) : null}
              </div>
            </Tooltip>
          </div>
        )
      })}
    </div>
  )
}

function SortTh({
  field,
  current,
  dir,
  onToggle,
  children,
  className,
}: {
  field: SortKey
  current: SortKey
  dir: SortDir
  onToggle: (k: SortKey) => void
  children: React.ReactNode
  className?: string
}) {
  const active = current === field
  const Icon = active && dir === 'asc' ? ArrowUp : ArrowDown
  return (
    <th className={cn('sortable-th', className)} onClick={() => onToggle(field)}>
      <span className="sort-label">
        {children}
        <Icon className={cn('sort-icon', active && 'active')} size={12} strokeWidth={2} aria-hidden="true" />
      </span>
    </th>
  )
}

function sortVal(r: ApiRequest, key: SortKey): number | string {
  switch (key) {
    case 'startedAt':
      return r.startedAt
    case 'durationMs':
      return r.durationMs
    case 'statusCode':
      return r.statusCode
    case 'totalTokens':
      return r.totalTokens ?? 0
  }
}

function formatWhen(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  if (sameDay) return d.toLocaleTimeString([], { hour12: false })
  return d.toLocaleString([], {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}
