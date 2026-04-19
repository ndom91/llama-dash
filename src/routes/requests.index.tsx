import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { ArrowDown, ArrowUp, Download, RefreshCw, Search, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
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

  const allRows = useMemo(() => data?.pages.flatMap((p) => p.requests) ?? [], [data])

  const models = useMemo(() => {
    const set = new Set<string>()
    for (const r of allRows) if (r.model) set.add(r.model)
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

  const errCount = useMemo(() => filtered.filter((r) => r.statusCode >= 400).length, [filtered])

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
            <span className="live-badge">
              <StatusDot tone="ok" live />
              live
            </span>
          </>
        }
      />
      <div className="content">
        <div className="page">
          <PageHeader kicker="§03 · requests" title="Request log" subtitle="proxied API calls, newest first" />

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
                  Clear
                </button>
              ) : null}
            </div>
          </div>

          {histogram && histogram.length > 0 ? (
            <section className="panel">
              <div className="histogram-header">
                <div>
                  <span className="panel-title">req/s</span>
                  <span className="panel-sub" style={{ marginLeft: 8 }}>
                    last 60m · bucket 1m
                  </span>
                </div>
              </div>
              <Histogram buckets={histogram} />
              <div className="histogram-labels">
                <span>-60m</span>
                <span>-40m</span>
                <span>-20m</span>
                <span>now</span>
              </div>
            </section>
          ) : null}

          <section className="panel">
            <div className="panel-head">
              <span className="panel-title">Log</span>
              <span className="panel-sub">
                {filtered.length} rows{errCount > 0 ? ` · ${errCount} errors` : ''}
              </span>
              <span
                style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-faint)' }}
              >
                ↑↓ navigate · ⏎ open · / search
              </span>
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
              <table className="dtable">
                <thead>
                  <tr>
                    <SortTh
                      field="startedAt"
                      current={sortKey}
                      dir={sortDir}
                      onToggle={toggleSort}
                      className="mono"
                      style={{ width: 100, whiteSpace: 'nowrap' }}
                    >
                      t
                    </SortTh>
                    <th className="mono" style={{ width: '22%' }}>
                      endpoint
                    </th>
                    <th style={{ width: '28%' }}>model</th>
                    <SortTh
                      field="statusCode"
                      current={sortKey}
                      dir={sortDir}
                      onToggle={toggleSort}
                      style={{ width: 70 }}
                    >
                      status
                    </SortTh>
                    <SortTh
                      field="totalTokens"
                      current={sortKey}
                      dir={sortDir}
                      onToggle={toggleSort}
                      className="num"
                      style={{ width: 80 }}
                    >
                      tok-in
                    </SortTh>
                    <th className="num" style={{ width: 80 }}>
                      tok-out
                    </th>
                    <SortTh
                      field="durationMs"
                      current={sortKey}
                      dir={sortDir}
                      onToggle={toggleSort}
                      className="num"
                      style={{ width: 140 }}
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
                      <td className="mono dim" style={{ whiteSpace: 'nowrap' }}>
                        {formatWhen(r.startedAt)}
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
                        <DurationBar ms={r.durationMs} isErr={r.statusCode >= 400} />
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
        const okH = ok > 0 ? Math.max((ok / maxTotal) * barPx, 3) : 2
        const errH = b.errors > 0 ? Math.max((b.errors / maxTotal) * barPx, 3) : 0
        const empty = b.total === 0
        const time = new Date(b.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        const label = empty ? time : `${time} · ${b.total}${b.errors ? ` (${b.errors} err)` : ''}`
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
