import { useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { ChevronRight, Download, RefreshCw } from 'lucide-react'
import { useMemo, useState } from 'react'
import { DurationBar } from '../components/DurationBar'
import { ModelTimeline } from '../components/ModelTimeline'
import { Sparkline } from '../components/Sparkline'
import { StatusCell } from '../components/StatusCell'
import { StatusDot, stateTone } from '../components/StatusDot'
import { Tooltip } from '../components/Tooltip'
import { TopBar } from '../components/TopBar'
import type { ApiModel, ApiRequest } from '../lib/api'
import { qk, useHealth, useModelTimeline, useModels, useRecentRequests, useRequestStats } from '../lib/queries'

export const Route = createFileRoute('/')({ component: Dashboard })

function Dashboard() {
  const qc = useQueryClient()
  const { data: models } = useModels()
  const { data: requests } = useRecentRequests(12)
  const { data: stats } = useRequestStats()
  const { data: health } = useHealth()
  const { data: timelineEvents } = useModelTimeline()
  const [refreshing, setRefreshing] = useState(false)

  const doRefresh = async () => {
    setRefreshing(true)
    await Promise.all([
      qc.invalidateQueries({ queryKey: qk.models }),
      qc.invalidateQueries({ queryKey: qk.requestsRecent }),
      qc.invalidateQueries({ queryKey: qk.requestStats }),
      qc.invalidateQueries({ queryKey: qk.modelTimeline }),
    ])
    setRefreshing(false)
  }

  const running = useMemo(() => models?.filter((m) => m.running) ?? [], [models])

  return (
    <div className="main-col">
      <TopBar
        actions={
          <>
            <Tooltip label="Refresh">
              <button
                type="button"
                className="btn btn-ghost btn-icon"
                onClick={doRefresh}
                disabled={refreshing}
                aria-label="Refresh dashboard"
              >
                <RefreshCw
                  className={`icon-14${refreshing ? ' animate-spin' : ''}`}
                  strokeWidth={1.75}
                  aria-hidden="true"
                />
              </button>
            </Tooltip>
            <Tooltip label="Export CSV">
              <button type="button" className="btn btn-ghost btn-icon" disabled aria-label="Export CSV">
                <Download className="icon-14" strokeWidth={1.75} aria-hidden="true" />
              </button>
            </Tooltip>
          </>
        }
      />
      <div className="content">
        <div className="page">
          <div className="kicker" style={{ marginBottom: 4 }}>
            §01 · overview
          </div>
          <h1 className="page-title">Operator dashboard</h1>
          <p className="page-sub">what's loaded, what just ran</p>

          <div className="stats-row">
            <StatCard
              label="req/s · 1m"
              value={stats ? stats.reqPerSec.toFixed(1) : '—'}
              unit="per-sec"
              sparkline={stats?.sparklines.reqs}
            />
            <StatCard
              label="tok/s · 1m"
              value={stats ? Math.round(stats.tokPerSec).toLocaleString() : '—'}
              unit="tok-sec"
              sparkline={stats?.sparklines.toks}
            />
            <StatCard
              label="p50 latency"
              value={stats ? formatLatency(stats.p50Latency) : '—'}
              unit="seconds"
              sparkline={stats?.sparklines.latency}
            />
            <StatCard
              label="error rate"
              value={stats ? stats.errorRate.toFixed(1) : '—'}
              unit="percent"
              sparkline={stats?.sparklines.errors}
              color="var(--err)"
            />
          </div>

          {timelineEvents ? <ModelTimeline events={timelineEvents} /> : null}

          <div className="dash-grid">
            <RunningModelsPanel running={running} total={models?.length ?? null} />
            <UpstreamHealthPanel health={health} />
          </div>

          <RecentRequestsPanel requests={requests ?? null} />
        </div>
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  unit,
  sparkline,
  color,
}: {
  label: string
  value: string
  unit: string
  sparkline?: Array<number>
  color?: string
}) {
  return (
    <div className="stat-card">
      <div className="stat-card-label">{label}</div>
      <div className="stat-card-row">
        <span className="stat-card-value">{value}</span>
        <span className="stat-card-unit">{unit}</span>
      </div>
      {sparkline ? <Sparkline data={sparkline} height={32} color={color} /> : null}
    </div>
  )
}

function RunningModelsPanel({ running, total }: { running: Array<ApiModel>; total: number | null }) {
  return (
    <section className="panel">
      <div className="panel-head">
        <span className="panel-title">Running</span>
        <span className="panel-sub">{total == null ? '—' : `${running.length} of ${total} loaded`}</span>
        <Link to="/models" className="btn btn-ghost btn-xs" style={{ marginLeft: 'auto' }}>
          manage
          <ChevronRight className="icon-btn-12" strokeWidth={2} aria-hidden="true" />
        </Link>
      </div>
      {total == null ? (
        <div className="empty-state">loading…</div>
      ) : running.length === 0 ? (
        <div className="empty-state">
          idle — no models loaded. Hit <code translate="no">/v1/chat/completions</code> to swap one in.
        </div>
      ) : (
        <table className="dtable">
          <thead>
            <tr>
              <th style={{ width: 18 }} aria-label="state" />
              <th className="mono">id</th>
              <th>name</th>
              <th style={{ width: 80 }}>state</th>
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
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}

function UpstreamHealthPanel({
  health,
}: {
  health:
    | { upstream: { reachable: true; health: string; version: string } | { reachable: false; error: string } }
    | undefined
}) {
  const up = health?.upstream
  const version = up?.reachable ? up.version : null
  const healthStatus = up?.reachable ? up.health : null

  return (
    <section className="panel">
      <div className="panel-head">
        <span className="panel-title">Upstream</span>
        <span className="panel-sub">llama-swap health</span>
      </div>
      <dl className="dl-grid">
        <dt>version</dt>
        <dd className="mono">{version ? `v${version}` : '—'}</dd>
        <dt>/health</dt>
        <dd className="mono">
          {healthStatus ? (
            <>
              <StatusDot tone="ok" /> <span style={{ marginLeft: 6 }}>{healthStatus}</span>
            </>
          ) : (
            <>
              <StatusDot tone="err" /> <span style={{ marginLeft: 6 }}>unreachable</span>
            </>
          )}
        </dd>
      </dl>
    </section>
  )
}

function RecentRequestsPanel({ requests }: { requests: Array<ApiRequest> | null }) {
  const navigate = useNavigate()
  const errCount = useMemo(() => requests?.filter((r) => r.statusCode >= 400).length ?? 0, [requests])

  return (
    <section className="panel" style={{ marginTop: 16 }}>
      <div className="panel-head">
        <span className="panel-title">Recent requests</span>
        <span className="panel-sub">
          newest first · {requests?.length ?? 0} shown{errCount > 0 ? ` · ${errCount} errors` : ''}
        </span>
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
                t
              </th>
              <th className="mono">endpoint</th>
              <th>model</th>
              <th style={{ width: 80 }}>status</th>
              <th className="num" style={{ width: 72 }}>
                tok-in
              </th>
              <th className="num" style={{ width: 72 }}>
                tok-out
              </th>
              <th className="num" style={{ width: 180 }}>
                duration
              </th>
            </tr>
          </thead>
          <tbody>
            {requests.map((r) => (
              <tr
                key={r.id}
                className="clickable-row"
                onClick={() => navigate({ to: '/requests/$id', params: { id: r.id } })}
              >
                <td className="mono dim">{new Date(r.startedAt).toLocaleTimeString([], { hour12: false })}</td>
                <td className="mono" translate="no">
                  {r.endpoint}
                </td>
                <td
                  className="dim"
                  style={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
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
  )
}

function formatLatency(ms: number): string {
  if (ms < 1000) return `${ms}`
  return (ms / 1000).toFixed(2)
}
