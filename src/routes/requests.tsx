import { createFileRoute } from '@tanstack/react-router'
import { RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { DurationBar } from '../components/DurationBar'
import { StatusCell } from '../components/StatusCell'
import { StatusDot } from '../components/StatusDot'
import { Tooltip } from '../components/Tooltip'
import { TopBar } from '../components/TopBar'
import { api, type ApiRequest } from '../lib/api'

export const Route = createFileRoute('/requests')({ component: Requests })

const PAGE_SIZE = 50

function Requests() {
  const [rows, setRows] = useState<Array<ApiRequest>>([])
  const [cursor, setCursor] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const loadFirst = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.listRequests({ limit: PAGE_SIZE })
      setRows(data.requests)
      setCursor(data.nextCursor)
      setErr(null)
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadFirst()
  }, [loadFirst])

  const loadMore = useCallback(async () => {
    if (cursor == null || loadingMore) return
    setLoadingMore(true)
    try {
      const data = await api.listRequests({ limit: PAGE_SIZE, cursor })
      setRows((prev) => [...prev, ...data.requests])
      setCursor(data.nextCursor)
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setLoadingMore(false)
    }
  }, [cursor, loadingMore])

  // Walk the list once — avoids Math.max(...rows.map()) creating a throwaway array per render.
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
                onClick={loadFirst}
                disabled={loading}
                aria-label="Refresh request log"
              >
                <RefreshCw
                  className={`icon-14${loading ? ' animate-spin' : ''}`}
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

          {err ? <div className="err-banner">{err}</div> : null}

          <section className="panel">
            {loading && rows.length === 0 ? (
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
                    <tr key={r.id}>
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

          {cursor != null ? (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
              <button type="button" className="btn btn-xs" onClick={loadMore} disabled={loadingMore}>
                {loadingMore ? 'loading…' : 'load more'}
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
