import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { RefreshCw } from 'lucide-react'
import { useMemo } from 'react'
import { DurationBar } from '../components/DurationBar'
import { StatusCell } from '../components/StatusCell'
import { StatusDot } from '../components/StatusDot'
import { Tooltip } from '../components/Tooltip'
import { TopBar } from '../components/TopBar'
import { useRequestsList } from '../lib/queries'

export const Route = createFileRoute('/requests/')({ component: Requests })

function Requests() {
  const navigate = useNavigate()
  const { data, error, isLoading, isRefetching, refetch, hasNextPage, fetchNextPage, isFetchingNextPage } =
    useRequestsList()

  const rows = useMemo(() => data?.pages.flatMap((p) => p.requests) ?? [], [data])

  const max = useMemo(() => {
    let m = 1
    for (const r of rows) if (r.durationMs > m) m = r.durationMs
    return m
  }, [rows])

  return (
    <div className="main-col">
      <TopBar
        actions={
          <>
            <span className="topbar-chip" title="Rows currently in view" aria-live="polite">
              <StatusDot tone="ok" live />
              <span>log</span>
              <span className="topbar-chip-num">{rows.length}</span>
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
            every call through <code translate="no">/v1/*</code>, newest first — bodies not stored
          </p>

          {error ? <div className="err-banner">{error.message}</div> : null}

          <section className="panel">
            {isLoading ? (
              <div className="empty-state">loading…</div>
            ) : rows.length === 0 ? (
              <div className="empty-state">
                no requests yet. call <code translate="no">/v1/*</code> to populate this view.
              </div>
            ) : (
              <table className="dtable">
                <thead>
                  <tr>
                    <th className="mono" style={{ width: 150 }}>
                      when
                    </th>
                    <th className="mono" style={{ width: 64 }}>
                      method
                    </th>
                    <th className="mono">endpoint</th>
                    <th style={{ minWidth: 160 }}>model</th>
                    <th style={{ width: 110 }}>status</th>
                    <th className="num" style={{ width: 72 }}>
                      in
                    </th>
                    <th className="num" style={{ width: 72 }}>
                      out
                    </th>
                    <th className="num" style={{ width: 180 }}>
                      duration
                    </th>
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
