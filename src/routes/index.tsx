import { createFileRoute, Link } from '@tanstack/react-router'
import { ChevronRight, RefreshCw } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { DurationBar } from '../components/DurationBar'
import { StatusCell } from '../components/StatusCell'
import { StatusDot, stateTone } from '../components/StatusDot'
import { TopBar } from '../components/TopBar'
import { api, type ApiModel, type ApiRequest } from '../lib/api'
import { useLiveData } from '../lib/live-data'

export const Route = createFileRoute('/')({ component: Dashboard })

function Dashboard() {
  const { models, err: liveErr, refresh } = useLiveData()
  const [requests, setRequests] = useState<Array<ApiRequest> | null>(null)
  const [reqErr, setReqErr] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    let cancelled = false
    api
      .listRequests({ limit: 10 })
      .then((r) => !cancelled && setRequests(r.requests))
      .catch((e: Error) => !cancelled && setReqErr(e.message))
    return () => {
      cancelled = true
    }
  }, [])

  const doRefresh = async () => {
    setRefreshing(true)
    try {
      const [, r] = await Promise.all([refresh(), api.listRequests({ limit: 10 })])
      setRequests(r.requests)
      setReqErr(null)
    } catch (e) {
      setReqErr(e instanceof Error ? e.message : String(e))
    } finally {
      setRefreshing(false)
    }
  }

  const running = useMemo(() => models?.filter((m) => m.running) ?? [], [models])
  const err = liveErr ?? reqErr

  return (
    <div className="main-col">
      <TopBar
        actions={
          <button
            type="button"
            className="btn btn-ghost btn-icon"
            onClick={doRefresh}
            disabled={refreshing}
            aria-label="Refresh dashboard"
            title="Refresh"
          >
            <RefreshCw
              className={`icon-14${refreshing ? ' animate-spin' : ''}`}
              strokeWidth={1.75}
              aria-hidden="true"
            />
          </button>
        }
      />
      <div className="content">
        <div className="page">
          <h1 className="page-title">Dashboard</h1>
          <p className="page-sub">what’s loaded, what just ran</p>

          {err ? <div className="err-banner">{err}</div> : null}

          <div style={{ display: 'grid', gap: 20 }}>
            <RunningModelsPanel running={running} total={models?.length ?? null} />
            <RecentRequestsPanel requests={requests} />
          </div>
        </div>
      </div>
    </div>
  )
}

function RunningModelsPanel({ running, total }: { running: Array<ApiModel>; total: number | null }) {
  return (
    <section className="panel">
      <div className="panel-head">
        <span className="panel-title">Running</span>
        <span className="panel-sub">{total == null ? '—' : `${running.length} / ${total} loaded`}</span>
        <Link to="/models" className="btn btn-ghost btn-xs" style={{ marginLeft: 'auto' }}>
          manage
          <ChevronRight className="icon-btn-12" strokeWidth={2} aria-hidden="true" />
        </Link>
      </div>
      {total == null ? (
        <div className="empty-state">loading…</div>
      ) : running.length === 0 ? (
        <div className="empty-state">
          idle — no models currently loaded. Hit <code translate="no">/v1/chat/completions</code> to swap one in.
        </div>
      ) : (
        <table className="dtable">
          <thead>
            <tr>
              <th style={{ width: 18 }} aria-label="state" />
              <th className="mono">id</th>
              <th>name</th>
              <th style={{ width: 120 }}>state</th>
              <th style={{ width: 80 }} className="num">
                ttl
              </th>
            </tr>
          </thead>
          <tbody>
            {running.map((m) => (
              <tr key={m.id}>
                <td>
                  <StatusDot tone={stateTone(m.state, m.running)} live />
                </td>
                <td className="mono" translate="no">
                  {m.id}
                </td>
                <td>{m.name}</td>
                <td>
                  <span className={`state-label state-label-${stateTone(m.state, m.running)}`}>{m.state}</span>
                </td>
                <td className="num dim">{m.ttl ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}

function RecentRequestsPanel({ requests }: { requests: Array<ApiRequest> | null }) {
  const max = useMemo(() => {
    if (!requests || requests.length === 0) return 1
    let m = 1
    for (const r of requests) if (r.durationMs > m) m = r.durationMs
    return m
  }, [requests])
  return (
    <section className="panel">
      <div className="panel-head">
        <span className="panel-title">Recent requests</span>
        <span className="panel-sub">newest first</span>
        <Link to="/requests" className="btn btn-ghost btn-xs" style={{ marginLeft: 'auto' }}>
          view all
          <ChevronRight className="icon-btn-12" strokeWidth={2} aria-hidden="true" />
        </Link>
      </div>
      {requests == null ? (
        <div className="empty-state">loading…</div>
      ) : requests.length === 0 ? (
        <div className="empty-state">
          no requests yet. proxy one through <code translate="no">/v1/*</code> to see it here.
        </div>
      ) : (
        <table className="dtable">
          <thead>
            <tr>
              <th className="mono" style={{ width: 80 }}>
                time
              </th>
              <th className="mono">endpoint</th>
              <th>model</th>
              <th style={{ width: 110 }}>status</th>
              <th className="num" style={{ width: 120 }}>
                tokens
              </th>
              <th className="num" style={{ width: 180 }}>
                duration
              </th>
            </tr>
          </thead>
          <tbody>
            {requests.map((r) => (
              <tr key={r.id}>
                <td className="mono dim">{new Date(r.startedAt).toLocaleTimeString([], { hour12: false })}</td>
                <td className="mono" translate="no">
                  {r.endpoint}
                </td>
                <td
                  className="dim"
                  style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  translate="no"
                >
                  {r.model ?? '—'}
                </td>
                <td>
                  <StatusCell code={r.statusCode} streamed={r.streamed} />
                </td>
                <td className="num">{r.totalTokens ?? '—'}</td>
                <td>
                  <DurationBar ms={r.durationMs} max={max} isErr={r.statusCode >= 400} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}
