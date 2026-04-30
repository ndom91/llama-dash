import { useVirtualizer } from '@tanstack/react-virtual'
import { useNavigate } from '@tanstack/react-router'
import { Search, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DurationBar } from '../../components/DurationBar'
import { PageHeader } from '../../components/PageHeader'
import { StatusCell } from '../../components/StatusCell'
import { StatusDot } from '../../components/StatusDot'
import { Tooltip } from '../../components/Tooltip'
import { TopBar } from '../../components/TopBar'
import { cn } from '../../lib/cn'
import { useRequestHistogram, useRequestsList } from '../../lib/queries'
import { formatCostUsd } from './requestDetailUtils'
import { RequestsHistogram } from './RequestsHistogram'
import { RequestsPageSkeleton } from './RequestsPageSkeleton'
import { RequestsRefreshButton } from './RequestsRefreshButton'
import { RequestsSortHeader } from './RequestsSortHeader'
import { RequestsVirtualColgroup } from './RequestsVirtualColgroup'
import {
  REQUESTS_ROW_HEIGHT,
  formatWhen,
  type RoutingFilter,
  sortVal,
  type SortDir,
  type SortKey,
  type StatusFilter,
} from './requestsListUtils'

type Props = {
  modelParam?: string
  sessionParam?: string
}

export function RequestsPage({ modelParam, sessionParam }: Props) {
  const navigate = useNavigate()
  const {
    data,
    error,
    isLoading,
    isRefetching,
    refetch,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
    dataUpdatedAt,
  } = useRequestsList()
  const { data: histogram } = useRequestHistogram()

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [modelFilter, setModelFilter] = useState<string>(modelParam ?? 'all')
  const [sortKey, setSortKey] = useState<SortKey>('startedAt')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [keyFilter, setKeyFilter] = useState<string>('all')
  const [routingFilter, setRoutingFilter] = useState<RoutingFilter>('all')
  const [clientFilter, setClientFilter] = useState('')
  const [hostFilter, setHostFilter] = useState('')
  const [endUserFilter, setEndUserFilter] = useState('')
  const [sessionFilter, setSessionFilter] = useState(sessionParam ?? '')
  const [selectedIdx, setSelectedIdx] = useState(-1)
  const refreshCycleKey = dataUpdatedAt || 'initial'
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

  useEffect(() => {
    setSessionFilter(sessionParam ?? '')
  }, [sessionParam])

  const filtered = useMemo(() => {
    let out = allRows

    if (statusFilter === 'ok') out = out.filter((r) => r.statusCode >= 200 && r.statusCode < 400)
    else if (statusFilter === 'err') out = out.filter((r) => r.statusCode >= 400)

    if (modelFilter !== 'all') out = out.filter((r) => r.model === modelFilter)

    if (keyFilter !== 'all') {
      if (keyFilter === '__none__') out = out.filter((r) => r.keyName == null)
      else out = out.filter((r) => r.keyName === keyFilter)
    }

    if (routingFilter === 'routed') out = out.filter((r) => r.routingActionType != null)
    else if (routingFilter === 'unrouted') out = out.filter((r) => r.routingActionType == null)

    if (clientFilter) out = out.filter((r) => (r.clientName ?? '').toLowerCase().includes(clientFilter.toLowerCase()))
    if (hostFilter) out = out.filter((r) => (r.clientHost ?? '').toLowerCase().includes(hostFilter.toLowerCase()))
    if (endUserFilter) out = out.filter((r) => (r.endUserId ?? '').toLowerCase().includes(endUserFilter.toLowerCase()))
    if (sessionFilter) out = out.filter((r) => (r.sessionId ?? '').toLowerCase().includes(sessionFilter.toLowerCase()))

    if (search) {
      const q = search.toLowerCase()
      out = out.filter(
        (r) =>
          r.endpoint.toLowerCase().includes(q) ||
          r.method.toLowerCase().includes(q) ||
          (r.model?.toLowerCase().includes(q) ?? false) ||
          (r.clientName?.toLowerCase().includes(q) ?? false) ||
          (r.clientHost?.toLowerCase().includes(q) ?? false) ||
          (r.endUserId?.toLowerCase().includes(q) ?? false) ||
          (r.sessionId?.toLowerCase().includes(q) ?? false) ||
          String(r.statusCode).includes(q),
      )
    }

    return out
  }, [
    allRows,
    statusFilter,
    modelFilter,
    keyFilter,
    routingFilter,
    clientFilter,
    hostFilter,
    endUserFilter,
    sessionFilter,
    search,
  ])

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

  const hasFilters =
    search !== '' ||
    statusFilter !== 'all' ||
    modelFilter !== 'all' ||
    keyFilter !== 'all' ||
    routingFilter !== 'all' ||
    clientFilter !== '' ||
    hostFilter !== '' ||
    endUserFilter !== '' ||
    sessionFilter !== ''

  return (
    <div className="main-col">
      <TopBar actions={null} />
      <div className="content">
        <div className="page flex min-h-full flex-1">
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
                <Tooltip label="Refresh">
                  <RequestsRefreshButton
                    cycleKey={refreshCycleKey}
                    isRefetching={isRefetching}
                    onRefresh={() => refetch()}
                  />
                </Tooltip>
              </div>
            }
          />

          {error ? <div className="err-banner mx-6 mt-3 max-md:mx-3">{error.message}</div> : null}

          {isLoading ? (
            <RequestsPageSkeleton />
          ) : (
            <div className="grid min-h-0 flex-1 grid-cols-[240px_minmax(0,1fr)] items-stretch gap-0 max-[900px]:grid-cols-1">
              <aside className="h-full border-border bg-surface-1 px-4 py-4 font-mono text-[11px] text-fg max-[900px]:border-r-0 max-[900px]:border-b">
                <div className="mb-4 flex flex-col gap-1.5">
                  <div className="text-[10px] uppercase tracking-[0.12em] text-fg-dim">Search</div>
                  <div className="relative min-w-0">
                    <Search
                      className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-fg-dim"
                      size={14}
                      strokeWidth={2}
                      aria-hidden="true"
                    />
                    <input
                      ref={searchRef}
                      type="text"
                      className="h-8 w-full rounded border border-border-strong bg-surface-2 px-7 pr-7 font-mono text-xs text-fg outline-none transition-[border-color,box-shadow] duration-100 focus:border-accent focus:[box-shadow:var(--shadow-focus)]"
                      placeholder="endpoint, model, status"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                    {!search ? (
                      <span className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 rounded-[3px] border border-border px-[3px] py-0 font-mono text-[10px] text-fg-faint">
                        /
                      </span>
                    ) : null}
                    {search ? (
                      <button
                        type="button"
                        className="absolute top-1/2 right-1.5 inline-flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-[3px] bg-transparent p-0 text-fg-dim transition-colors hover:bg-surface-3 hover:text-fg"
                        onClick={() => setSearch('')}
                        aria-label="Clear search"
                      >
                        <X size={12} strokeWidth={2} />
                      </button>
                    ) : null}
                  </div>
                </div>

                <div className="mb-4 flex flex-col gap-1.5">
                  <div className="text-[10px] uppercase tracking-[0.12em] text-fg-dim">Status</div>
                  <select
                    className="select-native h-8 w-full cursor-pointer rounded border border-border-strong bg-surface-2 px-2.5 font-mono text-xs text-fg outline-none transition-[border-color,box-shadow] duration-100 focus:border-accent focus:[box-shadow:var(--shadow-focus)]"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                  >
                    <option value="all">All status</option>
                    <option value="ok">Success</option>
                    <option value="err">Errors</option>
                  </select>
                </div>

                <div className="mb-4 flex flex-col gap-1.5">
                  <div className="text-[10px] uppercase tracking-[0.12em] text-fg-dim">Model</div>
                  <select
                    className="select-native h-8 w-full cursor-pointer rounded border border-border-strong bg-surface-2 px-2.5 font-mono text-xs text-fg outline-none transition-[border-color,box-shadow] duration-100 focus:border-accent focus:[box-shadow:var(--shadow-focus)]"
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
                  <div className="text-[10px] uppercase tracking-[0.12em] text-fg-dim">Key</div>
                  <select
                    className="select-native h-8 w-full cursor-pointer rounded border border-border-strong bg-surface-2 px-2.5 font-mono text-xs text-fg outline-none transition-[border-color,box-shadow] duration-100 focus:border-accent focus:[box-shadow:var(--shadow-focus)]"
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

                <div className="mb-4 flex flex-col gap-1.5">
                  <div className="text-[10px] uppercase tracking-[0.12em] text-fg-dim">Routing</div>
                  <select
                    className="select-native h-8 w-full cursor-pointer rounded border border-border-strong bg-surface-2 px-2.5 font-mono text-xs text-fg outline-none transition-[border-color,box-shadow] duration-100 focus:border-accent focus:[box-shadow:var(--shadow-focus)]"
                    value={routingFilter}
                    onChange={(e) => setRoutingFilter(e.target.value as RoutingFilter)}
                  >
                    <option value="all">All requests</option>
                    <option value="routed">Routed only</option>
                    <option value="unrouted">Unrouted only</option>
                  </select>
                </div>

                <div className="mb-4 flex flex-col gap-1.5">
                  <div className="text-[10px] uppercase tracking-[0.12em] text-fg-dim">Client</div>
                  <input
                    className="h-8 rounded border border-border-strong bg-surface-2 px-2 font-mono text-xs text-fg outline-none transition-[border-color,box-shadow] duration-100 focus:border-accent focus:[box-shadow:var(--shadow-focus)]"
                    type="text"
                    value={clientFilter}
                    onChange={(e) => setClientFilter(e.target.value)}
                    placeholder="claude-code"
                  />
                </div>

                <div className="mb-4 flex flex-col gap-1.5">
                  <div className="text-[10px] uppercase tracking-[0.12em] text-fg-dim">Host</div>
                  <input
                    className="h-8 rounded border border-border-strong bg-surface-2 px-2 font-mono text-xs text-fg outline-none transition-[border-color,box-shadow] duration-100 focus:border-accent focus:[box-shadow:var(--shadow-focus)]"
                    type="text"
                    value={hostFilter}
                    onChange={(e) => setHostFilter(e.target.value)}
                    placeholder="10.0.0.99"
                  />
                </div>

                <div className="mb-4 flex flex-col gap-1.5">
                  <div className="text-[10px] uppercase tracking-[0.12em] text-fg-dim">End user</div>
                  <input
                    className="h-8 rounded border border-border-strong bg-surface-2 px-2 font-mono text-xs text-fg outline-none transition-[border-color,box-shadow] duration-100 focus:border-accent focus:[box-shadow:var(--shadow-focus)]"
                    type="text"
                    value={endUserFilter}
                    onChange={(e) => setEndUserFilter(e.target.value)}
                    placeholder="alice"
                  />
                </div>

                <div className="mb-4 flex flex-col gap-1.5">
                  <div className="text-[10px] uppercase tracking-[0.12em] text-fg-dim">Session</div>
                  <input
                    className="h-8 rounded border border-border-strong bg-surface-2 px-2 font-mono text-xs text-fg outline-none transition-[border-color,box-shadow] duration-100 focus:border-accent focus:[box-shadow:var(--shadow-focus)]"
                    type="text"
                    value={sessionFilter}
                    onChange={(e) => setSessionFilter(e.target.value)}
                    placeholder="sess_123"
                  />
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
                      setRoutingFilter('all')
                      setClientFilter('')
                      setHostFilter('')
                      setEndUserFilter('')
                      setSessionFilter('')
                    }}
                  >
                    Clear filters
                  </button>
                ) : null}
              </aside>

              <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-0 border-l border-border bg-surface-0 max-[900px]:border-l-0">
                {histogram && histogram.length > 0 ? (
                  <section className="panel rounded-none! border-t-0! border-x-0! bg-surface-1!">
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

                <section className="panel !rounded-none !border-x-0 !border-t-0 !bg-surface-1 flex min-h-0 flex-1 flex-col">
                  <div className="panel-head bg-transparent px-4">
                    <span className="panel-title">Log</span>
                    <span className="panel-sub">
                      {filtered.length} rows{errCount > 0 ? ` · ${errCount} errors` : ''}
                    </span>
                    <span className="ml-auto font-mono text-[11px] text-fg-dim">↑↓ navigate · ⏎ open · / search</span>
                  </div>
                  {rows.length === 0 ? (
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
                    <div className="dtable-virtual-wrap flex min-h-0 flex-1 max-h-none flex-col">
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
                            <RequestsSortHeader
                              field="statusCode"
                              current={sortKey}
                              dir={sortDir}
                              onToggle={toggleSort}
                            >
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
                            <th className="num">cache</th>
                            <th className="num">cost</th>
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
                                        <span className="block overflow-hidden text-ellipsis whitespace-nowrap">
                                          {formatWhen(r.startedAt)}
                                        </span>
                                      </td>
                                      <td className="mono" translate="no">
                                        <span
                                          className="block overflow-hidden text-ellipsis whitespace-nowrap"
                                          title={r.endpoint}
                                        >
                                          {r.endpoint}
                                        </span>
                                      </td>
                                      <td className="dim" translate="no">
                                        <div className="flex min-w-0 items-center gap-2">
                                          <span
                                            className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap"
                                            title={r.model ?? '—'}
                                          >
                                            {r.model ?? '—'}
                                          </span>
                                          {r.routingActionType ? (
                                            <span
                                              className="shrink-0 border border-info/30 bg-info/10 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-info max-[1400px]:hidden"
                                              title={`${r.routingRuleName ?? 'routing rule'} · ${r.routingActionType}${r.routingRoutedModel ? ` · ${r.routingRoutedModel}` : ''}`}
                                            >
                                              {r.routingActionType === 'rewrite_model'
                                                ? 'rewrite'
                                                : r.routingActionType === 'noop'
                                                  ? 'continue'
                                                  : 'reject'}
                                            </span>
                                          ) : null}
                                        </div>
                                      </td>
                                      <td>
                                        <StatusCell code={r.statusCode} streamed={r.streamed} />
                                      </td>
                                      <td className="num dim">{r.promptTokens ?? '—'}</td>
                                      <td className="num">{r.completionTokens ?? '—'}</td>
                                      <td className="num dim">
                                        {'cacheReadTokens' in r ? (r.cacheReadTokens?.toLocaleString() ?? '—') : '—'}
                                      </td>
                                      <td className="num">
                                        {'costUsd' in r && r.costUsd != null ? formatCostUsd(r.costUsd) : '—'}
                                      </td>
                                      <td>
                                        <DurationBar
                                          ms={r.durationMs}
                                          maxMs={maxDuration}
                                          isErr={r.statusCode >= 400}
                                        />
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
          )}
        </div>
      </div>
    </div>
  )
}
