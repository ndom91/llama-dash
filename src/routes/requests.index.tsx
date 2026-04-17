import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { ArrowDown, ArrowUp, RefreshCw, Search, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { DurationBar } from '../components/DurationBar'
import { StatusCell } from '../components/StatusCell'
import { StatusDot } from '../components/StatusDot'
import { Tooltip } from '../components/Tooltip'
import { TopBar } from '../components/TopBar'
import type { ApiRequest } from '../lib/api'
import { useRequestsList } from '../lib/queries'

export const Route = createFileRoute('/requests/')({ component: Requests })

type SortKey = 'startedAt' | 'durationMs' | 'statusCode' | 'totalTokens'
type SortDir = 'asc' | 'desc'
type StatusFilter = 'all' | 'ok' | 'err'

function Requests() {
  const navigate = useNavigate()
  const { data, error, isLoading, isRefetching, refetch, hasNextPage, fetchNextPage, isFetchingNextPage } =
    useRequestsList()

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [modelFilter, setModelFilter] = useState<string>('all')
  const [sortKey, setSortKey] = useState<SortKey>('startedAt')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const allRows = useMemo(() => data?.pages.flatMap((p) => p.requests) ?? [], [data])

  const models = useMemo(() => {
    const set = new Set<string>()
    for (const r of allRows) if (r.model) set.add(r.model)
    return Array.from(set).sort()
  }, [allRows])

  const filtered = useMemo(() => {
    let out = allRows

    if (statusFilter === 'ok') out = out.filter((r) => r.statusCode >= 200 && r.statusCode < 400)
    else if (statusFilter === 'err') out = out.filter((r) => r.statusCode >= 400)

    if (modelFilter !== 'all') out = out.filter((r) => r.model === modelFilter)

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
  }, [allRows, statusFilter, modelFilter, search])

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

  const max = useMemo(() => {
    let m = 1
    for (const r of rows) if (r.durationMs > m) m = r.durationMs
    return m
  }, [rows])

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortKey(key)
      setSortDir(key === 'startedAt' ? 'desc' : 'asc')
    }
  }

  const hasFilters = search !== '' || statusFilter !== 'all' || modelFilter !== 'all'

  return (
    <div className="main-col">
      <TopBar
        actions={
          <>
            <span className="topbar-chip" title="Rows currently in view" aria-live="polite">
              <StatusDot tone="ok" live />
              <span>log</span>
              <span className="topbar-chip-num">
                {filtered.length !== allRows.length ? `${filtered.length} / ${allRows.length}` : allRows.length}
              </span>
            </span>
            <Tooltip label="Refresh">
              <button
                type="button"
                className="btn btn-ghost btn-icon"
                onClick={() => refetch()}
                disabled={isRefetching}
                aria-label="Refresh request log"
              >
                <RefreshCw
                  className={`icon-14${isRefetching ? ' animate-spin' : ''}`}
                  strokeWidth={1.75}
                  aria-hidden="true"
                />
              </button>
            </Tooltip>
          </>
        }
      />
      <div className="content">
        <div className="page">
          <h1 className="page-title">Requests</h1>
          <p className="page-sub">
            every call through <code translate="no">/v1/*</code>, newest first
          </p>

          {error ? <div className="err-banner">{error.message}</div> : null}

          <div className="list-toolbar">
            <div className="search-box">
              <Search className="search-icon" size={14} strokeWidth={2} aria-hidden="true" />
              <input
                type="text"
                className="search-input"
                placeholder="Search endpoint, model, status…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search ? (
                <button type="button" className="search-clear" onClick={() => setSearch('')} aria-label="Clear search">
                  <X size={12} strokeWidth={2} />
                </button>
              ) : null}
            </div>
            <div className="filter-group">
              <select
                className="filter-select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              >
                <option value="all">All status</option>
                <option value="ok">Success</option>
                <option value="err">Errors</option>
              </select>
              <select className="filter-select" value={modelFilter} onChange={(e) => setModelFilter(e.target.value)}>
                <option value="all">All models</option>
                {models.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
              {hasFilters ? (
                <button
                  type="button"
                  className="btn btn-ghost btn-xs"
                  onClick={() => {
                    setSearch('')
                    setStatusFilter('all')
                    setModelFilter('all')
                  }}
                >
                  Clear filters
                </button>
              ) : null}
            </div>
          </div>

          <section className="panel">
            {isLoading ? (
              <div className="empty-state">loading…</div>
            ) : rows.length === 0 ? (
              <div className="empty-state">
                {hasFilters ? (
                  'no requests match filters'
                ) : (
                  <>
                    no requests yet. call <code translate="no">/v1/*</code> to populate this view.
                  </>
                )}
              </div>
            ) : (
              <table className="dtable">
                <thead>
                  <tr>
                    <SortTh
                      field="startedAt"
                      current={sortKey}
                      dir={sortDir}
                      onToggle={toggleSort}
                      className="mono"
                      style={{ width: 150 }}
                    >
                      when
                    </SortTh>
                    <th className="mono" style={{ width: 64 }}>
                      method
                    </th>
                    <th className="mono">endpoint</th>
                    <th style={{ minWidth: 160 }}>model</th>
                    <SortTh
                      field="statusCode"
                      current={sortKey}
                      dir={sortDir}
                      onToggle={toggleSort}
                      style={{ width: 110 }}
                    >
                      status
                    </SortTh>
                    <SortTh
                      field="totalTokens"
                      current={sortKey}
                      dir={sortDir}
                      onToggle={toggleSort}
                      className="num"
                      style={{ width: 72 }}
                    >
                      in
                    </SortTh>
                    <th className="num" style={{ width: 72 }}>
                      out
                    </th>
                    <SortTh
                      field="durationMs"
                      current={sortKey}
                      dir={sortDir}
                      onToggle={toggleSort}
                      className="num"
                      style={{ width: 180 }}
                    >
                      duration
                    </SortTh>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr
                      key={r.id}
                      className="clickable-row"
                      onClick={() => navigate({ to: '/requests/$id', params: { id: r.id } })}
                    >
                      <td className="mono dim">{formatWhen(r.startedAt)}</td>
                      <td className="mono" style={{ color: 'var(--fg-muted)' }}>
                        {r.method}
                      </td>
                      <td className="mono" translate="no">
                        {r.endpoint}
                      </td>
                      <td
                        className="dim"
                        style={{
                          maxWidth: 260,
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
                        <DurationBar ms={r.durationMs} max={max} isErr={r.statusCode >= 400} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          {hasNextPage ? (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
              <button
                type="button"
                className="btn btn-xs"
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
              >
                {isFetchingNextPage ? 'loading…' : 'load more'}
              </button>
            </div>
          ) : null}
        </div>
      </div>
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
  style,
}: {
  field: SortKey
  current: SortKey
  dir: SortDir
  onToggle: (k: SortKey) => void
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
}) {
  const active = current === field
  const Icon = active && dir === 'asc' ? ArrowUp : ArrowDown
  return (
    <th className={`sortable-th ${className ?? ''}`} style={style} onClick={() => onToggle(field)}>
      <span className="sort-label">
        {children}
        <Icon className={`sort-icon${active ? ' active' : ''}`} size={12} strokeWidth={2} aria-hidden="true" />
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
