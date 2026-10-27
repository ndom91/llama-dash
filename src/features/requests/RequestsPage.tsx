import { useVirtualizer } from '@tanstack/react-virtual'
import { useQueryClient } from '@tanstack/react-query'
import { getRouteApi, useNavigate } from '@tanstack/react-router'
import { Search, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { RequestsSearch } from '../../routes/requests.index'
import { DurationBar } from '../../components/DurationBar'
import { PageHeader } from '../../components/PageHeader'
import { RouteError } from '../../components/RouteError'
import { Select, type SelectOption } from '../../components/Select'
import { StatusCell } from '../../components/StatusCell'
import { StatusDot } from '../../components/StatusDot'
import { cn } from '../../lib/cn'
import { formatCompactNumber } from '../../lib/format'
import { isTypingTarget } from '../../lib/is-typing-target'
import { isLeaderPending } from '../../lib/nav-leader'
import { requestQueryOptions, useAttributionSettings, useRequestHistogram, useRequestsList } from '../../lib/queries'
import { useMediaQuery } from '../../lib/use-media-query'
import { formatCostUsd } from './requestDetailUtils'
import { RequestsHistogram } from './RequestsHistogram'
import { RequestsPageSkeleton } from './RequestsPageSkeleton'
import { RequestsSortHeader } from './RequestsSortHeader'
import { RequestsVirtualColgroup } from './RequestsVirtualColgroup'
import {
  colWidthsFor,
  REQUESTS_ALL_COLS,
  REQUEST_KEY_FILTER_NONE,
  REQUEST_KEY_FILTER_PROXY,
  REQUESTS_ROW_HEIGHT,
  type RequestsColKey,
  formatWhen,
  isProxyRequestKey,
  requestKeyLabel,
  requestKeyNameFilterValue,
  requestMatchesKeyFilter,
  type RoutingFilter,
  sortVal,
  type SortDir,
  type SortKey,
  type StatusFilter,
} from './requestsListUtils'

const requestsRouteApi = getRouteApi('/requests/')

export function RequestsPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const routeSearch = requestsRouteApi.useSearch()
  const showMcpRelays = routeSearch.mcp === true
  const [selectedMinutes, setSelectedMinutes] = useState<number[]>([])
  const { data, error, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } = useRequestsList(selectedMinutes)
  const { data: histogram } = useRequestHistogram()
  const { data: attribution } = useAttributionSettings()

  const search = routeSearch.q ?? ''
  const statusFilter: StatusFilter = routeSearch.status ?? 'all'
  const modelFilter = routeSearch.model ?? NO_VALUES
  const sortKey: SortKey = routeSearch.sortKey ?? 'startedAt'
  const sortDir: SortDir = routeSearch.sortDir ?? 'desc'
  const keyFilter = routeSearch.key ?? NO_VALUES
  const routingFilter: RoutingFilter = routeSearch.routing ?? 'all'
  const clientFilter = routeSearch.client ?? ''
  const hostFilter = routeSearch.host ?? NO_VALUES
  const endUserFilter = routeSearch.endUser ?? ''
  const sessionFilter = routeSearch.session ?? ''
  const [searchDraft, setSearchDraft] = useState(search)

  const updateSearch = useCallback(
    (patch: Partial<RequestsSearch>) => {
      navigate({
        to: '/requests',
        search: (prev) => {
          const next: Record<string, unknown> = { ...prev, ...patch }
          for (const k of Object.keys(patch)) {
            const v = next[k]
            if (v === undefined || v === '' || v === 'all' || (Array.isArray(v) && v.length === 0)) delete next[k]
          }
          return next as RequestsSearch
        },
        replace: true,
      })
    },
    [navigate],
  )

  const [selectedIdx, setSelectedIdx] = useState(-1)
  const [hoveredRequestId, setHoveredRequestId] = useState<string | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setSearchDraft(search)
  }, [search])

  useEffect(() => {
    if (searchDraft === search) return
    const timeout = window.setTimeout(() => updateSearch({ q: searchDraft || undefined }), 180)
    return () => window.clearTimeout(timeout)
  }, [search, searchDraft, updateSearch])

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
  const hasProxyRequests = useMemo(() => allRows.some(isProxyRequestKey), [allRows])

  const hosts = useMemo(() => {
    const set = new Set<string>()
    for (const r of allRows) if (r.clientHost) set.add(r.clientHost)
    return Array.from(set).sort()
  }, [allRows])

  // Selected values stay listed even when the loaded page no longer contains them.
  const modelOptions = useMemo(() => withSelected(models.map(toOption), modelFilter), [models, modelFilter])
  const keyOptions = useMemo(
    () =>
      withSelected(
        [
          ...(hasProxyRequests ? [{ value: REQUEST_KEY_FILTER_PROXY, label: 'proxy' }] : []),
          { value: REQUEST_KEY_FILTER_NONE, label: 'No key' },
          ...keyNames.map((k) => ({ value: requestKeyNameFilterValue(k), label: k })),
        ],
        keyFilter,
      ),
    [hasProxyRequests, keyNames, keyFilter],
  )
  const hostOptions = useMemo(
    () => withSelected([{ value: REQUEST_HOST_FILTER_NONE, label: 'No host' }, ...hosts.map(toOption)], hostFilter),
    [hosts, hostFilter],
  )

  const filtered = useMemo(
    () =>
      applyRequestFilters(allRows, {
        statusFilter,
        modelFilter,
        keyFilter,
        routingFilter,
        clientFilter,
        hostFilter,
        endUserFilter,
        sessionFilter,
        search: searchDraft,
      }),
    [
      allRows,
      statusFilter,
      modelFilter,
      keyFilter,
      routingFilter,
      clientFilter,
      hostFilter,
      endUserFilter,
      sessionFilter,
      searchDraft,
    ],
  )

  const mcpCount = useMemo(() => filtered.filter(isMcpRelayRequest).length, [filtered])
  const displayed = useMemo(
    () => (showMcpRelays ? filtered : filtered.filter((r) => !isMcpRelayRequest(r))),
    [filtered, showMcpRelays],
  )

  useEffect(() => {
    if (modelFilter.length === 0 || models.length === 0) return
    if (modelFilter.every((f) => models.includes(f))) return
    const resolved = modelFilter.map((f) => models.find((m) => m === f || m.endsWith(`/${f}`)) ?? f)
    if (resolved.some((m, i) => m !== modelFilter[i])) updateSearch({ model: resolved })
  }, [models, modelFilter, updateSearch])

  const rows = useMemo(() => {
    const sorted = [...displayed]
    const dir = sortDir === 'asc' ? 1 : -1
    sorted.sort((a, b) => {
      const av = sortVal(a, sortKey)
      const bv = sortVal(b, sortKey)
      if (av < bv) return -1 * dir
      if (av > bv) return 1 * dir
      return 0
    })
    return sorted
  }, [displayed, sortKey, sortDir])

  const prefetchId = hoveredRequestId ?? rows[selectedIdx]?.id
  useEffect(() => {
    if (!prefetchId) return
    // Ignore rows crossed while moving the pointer or quickly stepping with j/k.
    const timer = window.setTimeout(() => {
      void qc.prefetchQuery(requestQueryOptions(prefetchId, 'low'))
    }, 100)
    return () => window.clearTimeout(timer)
  }, [prefetchId, qc])

  const openRequest = useCallback(
    (id: string) => {
      void qc.prefetchQuery(requestQueryOptions(id))
      void navigate({ to: '/requests/$id', params: { id } })
    },
    [navigate, qc],
  )

  const errCount = useMemo(() => displayed.filter((r) => r.statusCode >= 400).length, [displayed])
  const maxDuration = useMemo(() => Math.max(0, ...rows.map((r) => r.durationMs)), [rows])

  // responsive column visibility — table-layout:fixed so colgroup must match cells
  const dropCacheCost = useMediaQuery('(max-width: 1280px)')
  const dropTokens = useMediaQuery('(max-width: 1100px)')
  const dropApiKey = useMediaQuery('(max-width: 900px)')
  const visibleCols = useMemo(() => {
    const set = new Set<RequestsColKey>(REQUESTS_ALL_COLS)
    if (dropApiKey) set.delete('apiKey')
    if (dropCacheCost) {
      set.delete('cache')
      set.delete('cost')
    }
    if (dropTokens) {
      set.delete('tokIn')
      set.delete('tokOut')
    }
    return set
  }, [dropApiKey, dropCacheCost, dropTokens])
  const colWidths = useMemo(() => colWidthsFor(visibleCols), [visibleCols])
  const showApiKey = visibleCols.has('apiKey')
  const showCache = visibleCols.has('cache')
  const showCost = visibleCols.has('cost')
  const showTokIn = visibleCols.has('tokIn')
  const showTokOut = visibleCols.has('tokOut')

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
      if ((e.target as HTMLElement).closest?.('[data-request-histogram]')) return
      // isTypingTarget walks the composed path, so it also catches
      // contenteditable and nested wrappers that a bare tagName check missed —
      // and it doesn't treat <input type="button"> as typing.
      if (isTypingTarget(e)) {
        setSelectedIdx(-1)
        if (e.key === 'Escape') (e.target as HTMLElement).blur()
        return
      }

      // `g k` navigates to API Keys; without this, it would also move the row
      // selection up. See nav-leader.ts for why propagation can't be used here.
      if (isLeaderPending()) return

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
        openRequest(rows[selectedIdx].id)
      }
    },
    [rows, selectedIdx, openRequest],
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
    if (sortKey === key) {
      const nextDir: SortDir = sortDir === 'asc' ? 'desc' : 'asc'
      updateSearch({ sortDir: nextDir, sortKey: key })
    } else {
      const nextDir: SortDir = key === 'startedAt' ? 'desc' : 'asc'
      updateSearch({ sortKey: key, sortDir: nextDir })
    }
  }

  const hasFilters =
    searchDraft !== '' ||
    statusFilter !== 'all' ||
    modelFilter.length > 0 ||
    keyFilter.length > 0 ||
    routingFilter !== 'all' ||
    showMcpRelays ||
    clientFilter !== '' ||
    hostFilter.length > 0 ||
    endUserFilter !== '' ||
    sessionFilter !== '' ||
    selectedMinutes.length > 0

  if (error) {
    return <RouteError kicker="dsh · requests" title="Failed to load requests" message={error.message} />
  }

  return (
    <div className="content">
      <div className="page flex min-h-full flex-1">
        <PageHeader
          kicker="req · log"
          title="Request log"
          subtitle="proxied API calls, newest first"
          variant="integrated"
          action={
            <span className="live-badge requests-live-badge">
              <StatusDot tone="ok" live />
              live
            </span>
          }
        />

        {isLoading && selectedMinutes.length === 0 ? (
          <RequestsPageSkeleton />
        ) : (
          <div className="grid min-h-0 flex-1 grid-cols-[240px_minmax(0,1fr)] items-stretch gap-0 max-[1280px]:grid-cols-[200px_minmax(0,1fr)] max-[1100px]:grid-cols-[180px_minmax(0,1fr)] max-[900px]:grid-cols-1">
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
                    value={searchDraft}
                    onChange={(e) => setSearchDraft(e.target.value)}
                  />
                  {!searchDraft ? (
                    <span className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 rounded-[3px] border border-border px-[3px] py-0 font-mono text-[10px] text-fg-faint">
                      /
                    </span>
                  ) : null}
                  {searchDraft ? (
                    <button
                      type="button"
                      className="absolute top-1/2 right-1.5 inline-flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-[3px] bg-transparent p-0 text-fg-dim transition-colors hover:bg-surface-3 hover:text-fg"
                      onClick={() => {
                        setSearchDraft('')
                        updateSearch({ q: undefined })
                      }}
                      aria-label="Clear search"
                    >
                      <X size={12} strokeWidth={2} />
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="mb-4 flex flex-col gap-1.5">
                <div className="text-[10px] uppercase tracking-[0.12em] text-fg-dim">Status</div>
                <Select
                  aria-label="Status"
                  value={statusFilter}
                  onValueChange={(v) => updateSearch({ status: v as StatusFilter })}
                  options={STATUS_OPTIONS}
                />
              </div>

              <div className="mb-4 flex flex-col gap-1.5">
                <div className="text-[10px] uppercase tracking-[0.12em] text-fg-dim">Model</div>
                <Select
                  multiple
                  aria-label="Model"
                  placeholder="All models"
                  value={modelFilter}
                  onValueChange={(v) => updateSearch({ model: v })}
                  options={modelOptions}
                />
              </div>

              <div className="mb-4 flex flex-col gap-1.5">
                <div className="text-[10px] uppercase tracking-[0.12em] text-fg-dim">Key</div>
                <Select
                  multiple
                  aria-label="Key"
                  placeholder="All keys"
                  value={keyFilter}
                  onValueChange={(v) => updateSearch({ key: v })}
                  options={keyOptions}
                />
              </div>

              <div className="mb-4 flex flex-col gap-1.5">
                <div className="text-[10px] uppercase tracking-[0.12em] text-fg-dim">Routing</div>
                <Select
                  aria-label="Routing"
                  value={routingFilter}
                  onValueChange={(v) => updateSearch({ routing: v as RoutingFilter })}
                  options={ROUTING_OPTIONS}
                />
              </div>

              <label className="mb-4 flex cursor-pointer items-center gap-2 rounded border border-border bg-surface-2 px-2.5 py-2 text-fg-dim transition-colors hover:border-border-strong hover:text-fg">
                <input
                  type="checkbox"
                  className="accent-accent"
                  checked={showMcpRelays}
                  onChange={(e) => updateSearch({ mcp: e.target.checked ? true : undefined })}
                />
                <span className="flex min-w-0 flex-1 items-center justify-between gap-2 text-fg">
                  <span className="truncate">Show MCP reqs</span>
                  <span className="shrink-0 text-fg-faint">
                    {`${formatCompactNumber(mcpCount)} ${showMcpRelays ? 'visible' : 'hidden'}`}
                  </span>
                </span>
              </label>

              <div className="mb-4 flex flex-col gap-1.5">
                <div className="text-[10px] uppercase tracking-[0.12em] text-fg-dim">Host</div>
                <Select
                  multiple
                  aria-label="Host"
                  placeholder="All hosts"
                  value={hostFilter}
                  onValueChange={(v) => updateSearch({ host: v })}
                  options={hostOptions}
                />
              </div>

              <div className="mb-4 flex flex-col gap-1.5">
                <div className="text-[10px] uppercase tracking-[0.12em] text-fg-dim">
                  Client
                  <span className="ml-1.5 normal-case tracking-normal text-fg-faint">
                    {attribution?.clientNameHeader ?? 'x-client-name'}
                  </span>
                </div>
                <input
                  className="h-8 rounded border border-border-strong bg-surface-2 px-2 font-mono text-xs text-fg outline-none transition-[border-color,box-shadow] duration-100 focus:border-accent focus:[box-shadow:var(--shadow-focus)]"
                  type="text"
                  value={clientFilter}
                  onChange={(e) => updateSearch({ client: e.target.value })}
                  placeholder="claude-code"
                  autoComplete="off"
                  data-1p-ignore
                  data-lpignore="true"
                  data-bwignore="true"
                />
              </div>

              <div className="mb-4 flex flex-col gap-1.5">
                <div className="text-[10px] uppercase tracking-[0.12em] text-fg-dim">
                  End user
                  <span className="ml-1.5 normal-case tracking-normal text-fg-faint">
                    {attribution?.endUserIdHeader ?? 'x-end-user-id'}
                  </span>
                </div>
                <input
                  className="h-8 rounded border border-border-strong bg-surface-2 px-2 font-mono text-xs text-fg outline-none transition-[border-color,box-shadow] duration-100 focus:border-accent focus:[box-shadow:var(--shadow-focus)]"
                  type="text"
                  value={endUserFilter}
                  onChange={(e) => updateSearch({ endUser: e.target.value })}
                  placeholder="alice"
                  autoComplete="off"
                  data-1p-ignore
                  data-lpignore="true"
                  data-bwignore="true"
                />
              </div>

              <div className="mb-4 flex flex-col gap-1.5">
                <div className="text-[10px] uppercase tracking-[0.12em] text-fg-dim">
                  Session
                  <span className="ml-1.5 normal-case tracking-normal text-fg-faint">
                    {attribution?.sessionIdHeader ?? 'x-session-id'}
                  </span>
                </div>
                <input
                  className="h-8 rounded border border-border-strong bg-surface-2 px-2 font-mono text-xs text-fg outline-none transition-[border-color,box-shadow] duration-100 focus:border-accent focus:[box-shadow:var(--shadow-focus)]"
                  type="text"
                  value={sessionFilter}
                  onChange={(e) => updateSearch({ session: e.target.value })}
                  placeholder="sess_123"
                  autoComplete="off"
                  data-1p-ignore
                  data-lpignore="true"
                  data-bwignore="true"
                />
              </div>

              {hasFilters ? (
                <button
                  type="button"
                  className="btn btn-ghost btn-xs self-start"
                  onClick={() => {
                    setSearchDraft('')
                    setSelectedMinutes([])
                    updateSearch({
                      q: undefined,
                      status: undefined,
                      model: undefined,
                      key: undefined,
                      routing: undefined,
                      mcp: undefined,
                      host: undefined,
                      client: undefined,
                      endUser: undefined,
                      session: undefined,
                    })
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
                    {selectedMinutes.length > 0 ? (
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs ml-auto !inline-flex items-center"
                        aria-label="Clear time filter"
                        onClick={() => setSelectedMinutes([])}
                      >
                        <X className="size-3 shrink-0" strokeWidth={2} aria-hidden="true" /> <span>clear</span>
                      </button>
                    ) : null}
                  </div>
                  <RequestsHistogram buckets={histogram} selected={selectedMinutes} onSelect={setSelectedMinutes} />
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
                    {displayed.length} rows{errCount > 0 ? ` · ${errCount} errors` : ''}
                  </span>
                  <span className="ml-auto font-mono text-[11px] text-fg-dim">↑↓ navigate · ⏎ open · / search</span>
                </div>
                {isLoading ? (
                  <div className="empty-state">Loading requests…</div>
                ) : rows.length === 0 ? (
                  <div className="empty-state">
                    {hasFilters || allRows.length > 0 ? (
                      'no requests match filters'
                    ) : (
                      <>
                        no requests yet. call <code translate="no">/v1/*</code> to populate.
                      </>
                    )}
                    {hasNextPage ? (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm mx-auto mt-3 block"
                        disabled={isFetchingNextPage}
                        onClick={() => {
                          void fetchNextPage()
                        }}
                      >
                        {isFetchingNextPage ? 'Loading older requests…' : 'Load older requests'}
                      </button>
                    ) : null}
                  </div>
                ) : (
                  <div className="dtable-virtual-wrap flex min-h-0 flex-1 max-h-none flex-col">
                    <table className="dtable dtable-virtual">
                      <RequestsVirtualColgroup widths={colWidths} />
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
                          {showApiKey ? <th>api key</th> : null}
                          <th>model</th>
                          <RequestsSortHeader field="statusCode" current={sortKey} dir={sortDir} onToggle={toggleSort}>
                            status
                          </RequestsSortHeader>
                          {showTokIn ? (
                            <RequestsSortHeader
                              field="totalTokens"
                              current={sortKey}
                              dir={sortDir}
                              onToggle={toggleSort}
                              className="num"
                            >
                              tok-in
                            </RequestsSortHeader>
                          ) : null}
                          {showTokOut ? <th className="num">tok-out</th> : null}
                          {showCache ? <th className="num">cache</th> : null}
                          {showCost ? <th className="num">cost</th> : null}
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
                          const keyLabel = requestKeyLabel(r)
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
                              onPointerEnter={(e) => {
                                if (e.pointerType !== 'touch') setHoveredRequestId(r.id)
                              }}
                              onPointerLeave={() => setHoveredRequestId(null)}
                              onClick={() => openRequest(r.id)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') openRequest(r.id)
                              }}
                            >
                              <table className="dtable dtable-virtual">
                                <RequestsVirtualColgroup widths={colWidths} />
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
                                    {showApiKey ? (
                                      <td className="dim" translate="no">
                                        <span
                                          className="block overflow-hidden text-ellipsis whitespace-nowrap"
                                          title={keyLabel}
                                        >
                                          {keyLabel}
                                        </span>
                                      </td>
                                    ) : null}
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
                                              : r.routingActionType === 'continue' || r.routingActionType === 'noop'
                                                ? 'continue'
                                                : 'reject'}
                                          </span>
                                        ) : null}
                                      </div>
                                    </td>
                                    <td>
                                      <StatusCell code={r.statusCode} streamed={r.streamed} />
                                    </td>
                                    {showTokIn ? <td className="num dim">{r.promptTokens ?? '—'}</td> : null}
                                    {showTokOut ? <td className="num">{r.completionTokens ?? '—'}</td> : null}
                                    {showCache ? (
                                      <td className="num dim">
                                        {'cacheReadTokens' in r ? (r.cacheReadTokens?.toLocaleString() ?? '—') : '—'}
                                      </td>
                                    ) : null}
                                    {showCost ? (
                                      <td className="num">
                                        {'costUsd' in r && r.costUsd != null ? formatCostUsd(r.costUsd) : '—'}
                                      </td>
                                    ) : null}
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
        )}
      </div>
    </div>
  )
}

const NO_VALUES: readonly string[] = []
const REQUEST_HOST_FILTER_NONE = '__none__'

const STATUS_OPTIONS: readonly SelectOption[] = [
  { value: 'all', label: 'All status' },
  { value: 'ok', label: 'Success' },
  { value: 'err', label: 'Errors' },
]

const ROUTING_OPTIONS: readonly SelectOption[] = [
  { value: 'all', label: 'All requests' },
  { value: 'routed', label: 'Routed only' },
  { value: 'unrouted', label: 'Unrouted only' },
]

function toOption(value: string): SelectOption {
  return { value, label: value }
}

function withSelected(options: SelectOption[], selected: readonly string[]): SelectOption[] {
  const known = new Set(options.map((o) => o.value))
  const missing = selected.filter((v) => !known.has(v)).map(toOption)
  return missing.length > 0 ? [...options, ...missing] : options
}

function isMcpRelayRequest(row: { requestClass: string }): boolean {
  return row.requestClass === 'mcp_relay'
}

type RequestFilterRow = {
  statusCode: number
  model: string | null
  keyName: string | null
  routingAuthMode: string | null
  routingActionType: string | null
  clientName: string | null
  clientHost: string | null
  endUserId: string | null
  sessionId: string | null
  endpoint: string
  method: string
}

function applyRequestFilters<T extends RequestFilterRow>(
  rows: T[],
  filters: {
    statusFilter: StatusFilter
    modelFilter: readonly string[]
    keyFilter: readonly string[]
    routingFilter: RoutingFilter
    clientFilter: string
    hostFilter: readonly string[]
    endUserFilter: string
    sessionFilter: string
    search: string
  },
) {
  let out = rows
  const client = filters.clientFilter.toLowerCase()
  const endUser = filters.endUserFilter.toLowerCase()
  const session = filters.sessionFilter.toLowerCase()
  const query = filters.search.toLowerCase()

  if (filters.statusFilter === 'ok') out = out.filter((r) => r.statusCode >= 200 && r.statusCode < 400)
  else if (filters.statusFilter === 'err') out = out.filter((r) => r.statusCode >= 400)

  if (filters.modelFilter.length > 0) out = out.filter((r) => r.model != null && filters.modelFilter.includes(r.model))

  if (filters.keyFilter.length > 0) {
    out = out.filter((r) => filters.keyFilter.some((f) => requestMatchesKeyFilter(r, f)))
  }

  if (filters.routingFilter === 'routed') out = out.filter((r) => r.routingActionType != null)
  else if (filters.routingFilter === 'unrouted') out = out.filter((r) => r.routingActionType == null)

  if (client) {
    out = out.filter((r) => (r.clientName ?? '').toLowerCase().includes(client))
  }
  if (filters.hostFilter.length > 0) {
    out = out.filter((r) => filters.hostFilter.includes(r.clientHost ?? REQUEST_HOST_FILTER_NONE))
  }
  if (endUser) {
    out = out.filter((r) => (r.endUserId ?? '').toLowerCase().includes(endUser))
  }
  if (session) {
    out = out.filter((r) => (r.sessionId ?? '').toLowerCase().includes(session))
  }

  if (query) {
    out = out.filter(
      (r) =>
        r.endpoint.toLowerCase().includes(query) ||
        r.method.toLowerCase().includes(query) ||
        (r.model?.toLowerCase().includes(query) ?? false) ||
        (r.clientName?.toLowerCase().includes(query) ?? false) ||
        (r.clientHost?.toLowerCase().includes(query) ?? false) ||
        (r.endUserId?.toLowerCase().includes(query) ?? false) ||
        (r.sessionId?.toLowerCase().includes(query) ?? false) ||
        String(r.statusCode).includes(query),
    )
  }

  return out
}
