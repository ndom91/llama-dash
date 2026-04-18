import { useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { ChevronRight, Download, RefreshCw } from 'lucide-react'
import { useMemo, useState } from 'react'
import { DurationBar } from '../components/DurationBar'
import { ModelTimeline } from '../components/ModelTimeline'
import { PageHeader } from '../components/PageHeader'
import { Sparkline } from '../components/Sparkline'
import { StatusCell } from '../components/StatusCell'
import { StatusDot, stateTone } from '../components/StatusDot'
import { Tooltip } from '../components/Tooltip'
import { TopBar } from '../components/TopBar'
import type { ApiGpuSnapshot, ApiHealth, ApiModel, ApiRequest } from '../lib/api'
import { qk, useGpu, useHealth, useModelTimeline, useModels, useRecentRequests, useRequestStats } from '../lib/queries'

export const Route = createFileRoute('/')({ component: Dashboard })

function Dashboard() {
  const qc = useQueryClient()
  const { data: models } = useModels()
  const { data: requests } = useRecentRequests(12)
  const { data: stats } = useRequestStats()
  const { data: health } = useHealth()
  const { data: timelineEvents } = useModelTimeline()
  const { data: gpu } = useGpu()
  const [refreshing, setRefreshing] = useState(false)

  const doRefresh = async () => {
    setRefreshing(true)
    await Promise.all([
      qc.invalidateQueries({ queryKey: qk.models }),
      qc.invalidateQueries({ queryKey: qk.requestsRecent }),
      qc.invalidateQueries({ queryKey: qk.requestStats }),
      qc.invalidateQueries({ queryKey: qk.modelTimeline }),
      qc.invalidateQueries({ queryKey: qk.gpu }),
    ])
    setRefreshing(false)
  }

  const active = useMemo(() => models?.filter((m) => m.running || m.kind === 'peer') ?? [], [models])

  return (
    <div className="main-col">
      <TopBar />
      <div className="content">
        <div className="page">
          <PageHeader
            kicker="§01 · overview"
            title="Operator dashboard"
            subtitle="what's loaded, what just ran"
            action={
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

          <div className="stats-row">
            <StatCard
              label="req/s · 1m"
              value={stats ? formatRate(stats.reqPerSec) : '—'}
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
            <RunningModelsPanel active={active} total={models?.length ?? null} />
            <UpstreamHealthPanel health={health} gpu={gpu} />
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

function RunningModelsPanel({ active, total }: { active: Array<ApiModel>; total: number | null }) {
  const runningCount = active.filter((m) => m.running && m.kind !== 'peer').length
  const peerCount = active.filter((m) => m.kind === 'peer').length
  const subtitle =
    total == null
      ? '—'
      : `${runningCount} of ${total} loaded${peerCount > 0 ? ` · ${peerCount} peer${peerCount > 1 ? 's' : ''}` : ''}`
  return (
    <section className="panel running-panel">
      <div className="panel-head">
        <span className="panel-title">Running</span>
        <span className="panel-sub">{subtitle}</span>
        <Link to="/models" className="btn btn-ghost btn-xs" style={{ marginLeft: 'auto' }}>
          manage
          <ChevronRight className="icon-btn-12" strokeWidth={2} aria-hidden="true" />
        </Link>
      </div>
      {total == null ? (
        <div className="empty-state">loading…</div>
      ) : active.length === 0 ? (
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
            {active.map((m) => {
              const tone = m.kind === 'peer' ? ('warn' as const) : stateTone(m.state, m.running)
              const label = m.kind === 'peer' ? 'peer' : m.state
              return (
                <tr key={m.id}>
                  <td>
                    <StatusDot tone={tone} live />
                  </td>
                  <td className="mono" translate="no">
                    {m.id}
                  </td>
                  <td>{m.name}</td>
                  <td>
                    <span className={`state-label state-label-${tone}`}>{label}</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </section>
  )
}

function UpstreamHealthPanel({ health, gpu }: { health: ApiHealth | undefined; gpu: ApiGpuSnapshot | undefined }) {
  const up = health?.upstream

  return (
    <section className="panel">
      <div className="panel-head">
        <span className="panel-title">Upstream</span>
        <span className="panel-sub">llama-swap health</span>
      </div>
      <dl className="dl-grid">
        <dt>host</dt>
        <dd className="mono">{up?.reachable ? up.host : '—'}</dd>
        <dt>version</dt>
        <dd className="mono">{up?.reachable ? `v${up.version}` : '—'}</dd>
        <dt>/health</dt>
        <dd className="mono">
          {up?.reachable ? (
            <>
              <StatusDot tone="ok" />{' '}
              <span style={{ marginLeft: 6 }}>
                {up.health} · {up.latencyMs}ms
              </span>
            </>
          ) : (
            <>
              <StatusDot tone="err" /> <span style={{ marginLeft: 6 }}>unreachable</span>
            </>
          )}
        </dd>
        {gpu?.available ? gpu.gpus.map((g) => <GpuRow key={g.index} gpu={g} showIndex={gpu.gpus.length > 1} />) : null}
      </dl>
    </section>
  )
}

function GpuRow({ gpu, showIndex }: { gpu: ApiGpuSnapshot['gpus'][number]; showIndex: boolean }) {
  const label = showIndex ? `gpu ${gpu.index}` : 'gpu'
  const vramLabel = `${gpu.memoryUsedMiB.toLocaleString()} / ${gpu.memoryTotalMiB.toLocaleString()} MiB`
  return (
    <>
      <dt>{label}</dt>
      <dd className="mono">
        <span translate="no">{gpu.name}</span>
      </dd>
      <dt>vram</dt>
      <dd className="mono">
        <span className="gpu-vram-bar-wrap">
          <span className="gpu-vram-bar" style={{ width: `${gpu.memoryPercent}%` }} />
        </span>
        <span style={{ marginLeft: 8 }}>
          {vramLabel} ({gpu.memoryPercent}%)
        </span>
      </dd>
      <dt>util / temp</dt>
      <dd className="mono">
        {gpu.utilizationPercent}%{' '}
        <span className="dim">
          · {gpu.temperatureC}°C
          {gpu.powerW != null ? ` · ${Math.round(gpu.powerW)}W` : ''}
          {gpu.powerMaxW != null ? ` / ${Math.round(gpu.powerMaxW)}W` : ''}
        </span>
      </dd>
    </>
  )
}

function RecentRequestsPanel({ requests }: { requests: Array<ApiRequest> | null }) {
  const navigate = useNavigate()
  const errCount = useMemo(() => requests?.filter((r) => r.statusCode >= 400).length ?? 0, [requests])

  return (
    <section className="panel">
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

function formatRate(v: number): string {
  if (v === 0) return '0.0'
  if (v < 0.1) return v.toFixed(2)
  return v.toFixed(1)
}
