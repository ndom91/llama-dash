import { useVirtualizer } from '@tanstack/react-virtual'
import { useNavigate } from '@tanstack/react-router'
import { Download, RefreshCw, Search, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DurationBar } from '../../components/DurationBar'
import { PageHeader } from '../../components/PageHeader'
import { StatusCell } from '../../components/StatusCell'
import { StatusDot } from '../../components/StatusDot'
import { Tooltip } from '../../components/Tooltip'
import { TopBar } from '../../components/TopBar'
import { cn } from '../../lib/cn'
import { useRequestHistogram, useRequestsList } from '../../lib/queries'
import { RequestsHistogram } from './RequestsHistogram'
import { RequestsSortHeader } from './RequestsSortHeader'
import { RequestsVirtualColgroup } from './RequestsVirtualColgroup'
import {
  REQUESTS_ROW_HEIGHT,
  formatWhen,
  sortVal,
  type SortDir,
  type SortKey,
  type StatusFilter,
} from './requestsListUtils'

type Props = {
  modelParam?: string
}

export function RequestsPage({ modelParam }: Props) {
  const navigate = useNavigate()
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
  const scrollRef = useRef<HTMLDivElement>(null)

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

  const fetchNextRef = useRef({ hasNextPage, isFetchingNextPage, fetchNextPage, rowCount: rows.length })
  fetchNextRef.current = { hasNextPage, isFetchingNextPage, fetchNextPage, rowCount: rows.length }

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => REQUESTS_ROW_HEIGHT,
    overscan: 20,
    onChange: (v) => {
      const last = v.getVirtualItems().at(-1)
      if (!last) return
      const next = fetchNextRef.current
      if (last.index >= next.rowCount - 20 && next.hasNextPage && !next.isFetchingNextPage) {
        next.fetchNextPage()
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
        <div className="page min-h-full bg-surface-0">
          <PageHeader
            kicker="req · log"
            title="Request log"
            subtitle="proxied API calls, newest first"
            variant="integrated"
            action={
              <div className="flex items-center gap-2">
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
                      className={cn('icon-14', isRefetching && 'animate-spin')}
                      strokeWidth={1.75}
                      aria-hidden="true"
                    />
                  </button>
                </Tooltip>
              </div>
            }
          />

          {error ? <div className="err-banner mx-6 mt-3 max-md:mx-3">{error.message}</div> : null}

          <div className="grid min-h-0 grid-cols-[240px_minmax(0,1fr)] gap-0 max-[900px]:grid-cols-1">
            <aside className="border-r border-[color:color-mix(in_srgb,var(--border)_86%,transparent)] bg-surface-1 px-4 py-4 max-[900px]:border-r-0 max-[900px]:border-b">
              <div className="mb-4 flex flex-col gap-1.5">
                <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-fg-dim">Search</div>
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

              <div className="mb-4 flex flex-col gap-1.5">
                <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-fg-dim">Status</div>
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

              <div className="mb-4 flex flex-col gap-1.5">
                <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-fg-dim">Model</div>
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

              <div className="mb-4 flex flex-col gap-1.5">
                <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-fg-dim">Key</div>
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
                  className="btn btn-ghost btn-xs self-start"
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

            <div className="flex min-w-0 flex-col gap-0 bg-surface-0">
              {histogram && histogram.length > 0 ? (
                <section className="panel !rounded-none !border-x-0 !bg-surface-1">
                  <div className="histogram-header panel-head bg-transparent px-4">
                    <div>
                      <span className="panel-title">req/s</span>
                      <span className="panel-sub" style={{ marginLeft: 8 }}>
                        last 60m · bucket 1m
                      </span>
                    </div>
                  </div>
                  <RequestsHistogram buckets={histogram} />
                  <div className="histogram-labels px-4 pb-3">
                    <span>-60m</span>
                    <span>-40m</span>
                    <span>-20m</span>
                    <span>now</span>
                  </div>
                </section>
              ) : null}

              <section className="panel !rounded-none !border-x-0 !border-t-0 !bg-surface-1">
                <div className="panel-head bg-transparent px-4">
                  <span className="panel-title">Log</span>
                  <span className="panel-sub">
                    {filtered.length} rows{errCount > 0 ? ` · ${errCount} errors` : ''}
                  </span>
                  <span className="ml-auto font-mono text-[11px] text-fg-dim">↑↓ navigate · ⏎ open · / search</span>
                </div>
                {isLoading ? (
                  <div className="empty-state">loading…</div>
                ) : rows.length === 0 ? (
                  <div className="empty-state">
                    {hasFilters ? (
                      'no requests match filters'
                    ) : (
                      <>
                        no requests yet. call <code translate="no">/v1/*</code> to populate.
                      </>
                    )}
                  </div>
                ) : (
                  <div className="dtable-virtual-wrap max-h-[min(70vh,800px)]">
                    <table className="dtable dtable-virtual">
                      <RequestsVirtualColgroup />
                      <thead>
                        <tr>
                          <RequestsSortHeader
                            field="startedAt"
                            current={sortKey}
                            dir={sortDir}
                            onToggle={toggleSort}
                            className="mono"
                          >
                            t
                          </RequestsSortHeader>
                          <th className="mono">endpoint</th>
                          <th>model</th>
                          <RequestsSortHeader field="statusCode" current={sortKey} dir={sortDir} onToggle={toggleSort}>
                            status
                          </RequestsSortHeader>
                          <RequestsSortHeader
                            field="totalTokens"
                            current={sortKey}
                            dir={sortDir}
                            onToggle={toggleSort}
                            className="num"
                          >
                            tok-in
                          </RequestsSortHeader>
                          <th className="num">tok-out</th>
                          <RequestsSortHeader
                            field="durationMs"
                            current={sortKey}
                            dir={sortDir}
                            onToggle={toggleSort}
                            className="num"
                          >
                            duration
                          </RequestsSortHeader>
                        </tr>
                      </thead>
                    </table>
                    <div ref={scrollRef} className="dtable-virtual-body">
                      <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
                        {virtualizer.getVirtualItems().map((vRow) => {
                          const r = rows[vRow.index]
                          return (
                            // biome-ignore lint/a11y/noStaticElementInteractions: virtual row wrapper, keyboard nav handled in page-level listeners
                            <div
                              key={r.id}
                              tabIndex={-1}
                              className={cn('vt-row clickable-row', vRow.index === selectedIdx && 'selected-row')}
                              style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                width: '100%',
                                height: REQUESTS_ROW_HEIGHT,
                                transform: `translateY(${vRow.start}px)`,
                              }}
                              onClick={() => navigate({ to: '/requests/$id', params: { id: r.id } })}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') navigate({ to: '/requests/$id', params: { id: r.id } })
                              }}
                            >
                              <table className="dtable dtable-virtual">
                                <RequestsVirtualColgroup />
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
                                      style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
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
                        <div className="empty-state" style={{ paddingBlock: 8 }}>
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
