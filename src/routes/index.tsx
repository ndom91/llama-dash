import { useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { ChevronRight, Download, RefreshCw } from 'lucide-react'
import { useMemo, useState } from 'react'
import { CopyableCode } from '../components/CopyableCode'
import { DurationBar } from '../components/DurationBar'
import { PageHeader } from '../components/PageHeader'
import { Sparkline } from '../components/Sparkline'
import { StatusCell } from '../components/StatusCell'
import { StatusDot, stateTone } from '../components/StatusDot'
import { Tooltip } from '../components/Tooltip'
import { TopBar } from '../components/TopBar'
import type { ApiGpuSnapshot, ApiHealth, ApiModel, ApiModelEvent, ApiRequest } from '../lib/api'
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
        <div className="page dashboard-page">
          <PageHeader
            kicker="dsh · overview"
            title="Operator dashboard"
            subtitle="system overview and recent activity"
            variant="integrated"
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

          <div className="dashboard-shell">
            <TelemetryPanel health={health} gpu={gpu} />
            <div className="dashboard-main-stack">
              <div className="dashboard-metric-grid">
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

              <ResidencyPanel events={timelineEvents ?? []} active={active} />
            </div>

            <RunningModelsPanel active={active} total={models?.length ?? null} />

            <RecentRequestsPanel requests={requests ?? null} />
          </div>
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
    <div className="stat-card dashboard-stat-card">
      <div className="stat-card-label">{label}</div>
      <div className="stat-card-row">
        <span className="stat-card-value">{value}</span>
        <span className="stat-card-unit">{unit}</span>
      </div>
      {sparkline ? <Sparkline data={sparkline} height={32} color={color} /> : null}
    </div>
  )
}

function TelemetryPanel({ health, gpu }: { health: ApiHealth | undefined; gpu: ApiGpuSnapshot | undefined }) {
  const upstream = health?.upstream
  const gpus = gpu?.available ? gpu.gpus : []

  return (
    <section className="panel dashboard-panel dashboard-telemetry-panel">
      <div className="dashboard-section-kicker">Upstream</div>
      <dl className="dashboard-kv-list">
        <div>
          <dt>host</dt>
          <dd className="mono">{upstream?.reachable ? upstream.host : '—'}</dd>
        </div>
        <div>
          <dt>version</dt>
          <dd className="mono">{upstream?.reachable ? `v${upstream.version}` : '—'}</dd>
        </div>
        <div>
          <dt>/health</dt>
          <dd className="mono dashboard-health-inline">
            {upstream?.reachable ? (
              <>
                <StatusDot tone="ok" /> <span>ok · {upstream.latencyMs}ms</span>
              </>
            ) : (
              <>
                <StatusDot tone="err" /> <span>unreachable</span>
              </>
            )}
          </dd>
        </div>
      </dl>

      {gpus.length > 0
        ? gpus.map((gpuEntry, index) => (
            <div key={`${gpuEntry.index}-${gpuEntry.name}`} className="dashboard-gpu-block">
              <div className="dashboard-section-kicker">{gpus.length > 1 ? `GPU ${index + 1}` : 'GPU'}</div>
              <dl className="dashboard-kv-list">
                <div>
                  <dt>device</dt>
                  <dd className="mono">{gpuEntry.name}</dd>
                </div>
                {gpuEntry.memoryTotalMiB != null ? (
                  <div>
                    <dt>vram</dt>
                    <dd className="mono dashboard-vram-row">
                      <span>
                        {formatMiBGb(gpuEntry.memoryUsedMiB)} / {formatMiBGb(gpuEntry.memoryTotalMiB)}
                      </span>
                      <span>GB</span>
                    </dd>
                    <div className="dashboard-vram-track">
                      <span className="dashboard-vram-fill" style={{ width: `${gpuEntry.memoryPercent ?? 0}%` }} />
                    </div>
                  </div>
                ) : null}
                <div>
                  <dt>util · temp</dt>
                  <dd className="mono">
                    {gpuEntry.utilizationPercent != null ? `${gpuEntry.utilizationPercent}%` : '—'}
                    {gpuEntry.temperatureC != null ? ` · ${gpuEntry.temperatureC}°C` : ''}
                  </dd>
                </div>
              </dl>
            </div>
          ))
        : null}
    </section>
  )
}

type ResidencySpan = {
  modelId: string
  start: number
  end: number
}

const DASHBOARD_WINDOW_MS = 60 * 60_000

function ResidencyPanel({ events, active }: { events: Array<ApiModelEvent>; active: Array<ApiModel> }) {
  const now = Date.now()
  const windowStart = now - DASHBOARD_WINDOW_MS
  const spans = useMemo(() => buildResidencySpans(events, now), [events, now])
  const peerIds = useMemo(() => new Set(active.filter((m) => m.kind === 'peer').map((m) => m.id)), [active])
  const barColors = ['var(--ok)', 'var(--accent)', 'var(--info)']

  const rows = useMemo(() => {
    const byModel = new Map<string, Array<ResidencySpan>>()
    for (const span of spans) {
      const arr = byModel.get(span.modelId) ?? []
      arr.push(span)
      byModel.set(span.modelId, arr)
    }

    return active.map((model) => ({
      id: model.id,
      label: model.name || model.id,
      kind: model.kind,
      spans: byModel.get(model.id) ?? [],
    }))
  }, [active, spans])

  return (
    <section className="panel dashboard-panel dashboard-residency-panel">
      <div className="panel-head dashboard-panel-head">
        <span className="panel-title">Model residency</span>
        <span className="panel-sub">· 60 min</span>
        <span className="panel-sub" style={{ marginLeft: 'auto' }}>
          {active.filter((m) => m.running && m.kind !== 'peer').length} resident · {peerIds.size} peer
        </span>
      </div>
      <div className="dashboard-residency-body">
        {rows.length === 0 ? (
          <div className="dashboard-empty-state">no active model residency in the last hour</div>
        ) : (
          rows.map((row) => {
            const totalMs = row.spans.reduce((sum, span) => sum + (span.end - span.start), 0)
            return (
              <div key={row.id} className="dashboard-residency-row">
                <div className="dashboard-residency-label mono" translate="no">
                  {row.id}
                  <span className="dim">{row.kind === 'peer' ? ' · peer' : ''}</span>
                </div>
                <div className="dashboard-residency-track">
                  {row.spans.map((span) => {
                    const left = ((span.start - windowStart) / DASHBOARD_WINDOW_MS) * 100
                    const width = ((span.end - span.start) / DASHBOARD_WINDOW_MS) * 100
                    return (
                      <span
                        key={`${row.id}-${span.start}`}
                        className={`dashboard-residency-fill${row.kind === 'peer' ? ' is-peer' : ''}`}
                        style={{
                          left: `${left}%`,
                          width: `${Math.max(width, 0.8)}%`,
                          background:
                            row.kind === 'peer'
                              ? 'var(--info)'
                              : barColors[active.findIndex((m) => m.id === row.id) % barColors.length],
                        }}
                      />
                    )
                  })}
                </div>
                <div className="dashboard-residency-duration mono dim">{formatDurationMinutes(totalMs)}</div>
              </div>
            )
          })
        )}
        <div className="dashboard-residency-axis mono dim">
          <span>-60m</span>
          <span>-45m</span>
          <span>-30m</span>
          <span>-15m</span>
          <span>now</span>
        </div>
      </div>
    </section>
  )
}

function buildResidencySpans(events: Array<ApiModelEvent>, now: number): Array<ResidencySpan> {
  const windowStart = now - DASHBOARD_WINDOW_MS
  const active = new Map<string, number>()
  const spans: Array<ResidencySpan> = []

  for (const ev of events) {
    const ts = new Date(ev.timestamp).getTime()
    if (ev.event === 'load') {
      active.set(ev.modelId, ts)
      continue
    }
    const loadTs = active.get(ev.modelId)
    if (loadTs != null) {
      spans.push({ modelId: ev.modelId, start: Math.max(loadTs, windowStart), end: ts })
      active.delete(ev.modelId)
    }
  }

  for (const [modelId, start] of active) {
    spans.push({ modelId, start: Math.max(start, windowStart), end: now })
  }

  return spans
}

function RunningModelsPanel({ active, total }: { active: Array<ApiModel>; total: number | null }) {
  const navigate = useNavigate()
  const runningCount = active.filter((m) => m.running && m.kind !== 'peer').length
  const peerCount = active.filter((m) => m.kind === 'peer').length
  const subtitle =
    total == null
      ? '—'
      : `${runningCount} of ${total} loaded${peerCount > 0 ? ` · ${peerCount} peer${peerCount > 1 ? 's' : ''}` : ''}`
  return (
    <section className="panel dashboard-panel running-panel dashboard-running-panel">
      <div className="panel-head dashboard-panel-head">
        <span className="panel-title">Running</span>
        <span className="panel-sub">{subtitle}</span>
        <Link to="/models" className="dashboard-panel-link" style={{ marginLeft: 'auto' }}>
          manage
          <ChevronRight className="icon-btn-12" strokeWidth={2} aria-hidden="true" />
        </Link>
      </div>
      {total == null ? (
        <div className="empty-state dashboard-empty-state">loading…</div>
      ) : active.length === 0 ? (
        <div className="empty-state dashboard-empty-state">
          idle — no models loaded. Hit <code translate="no">/v1/chat/completions</code> to swap one in.
        </div>
      ) : (
        <table className="dtable dashboard-table dashboard-running-table">
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
                <tr
                  key={m.id}
                  className="clickable-row"
                  onClick={() => navigate({ to: '/models/$id', params: { id: m.id } })}
                >
                  <td>
                    <StatusDot tone={tone} live />
                  </td>
                  <td className="mono" translate="no">
                    {m.id}
                  </td>
                  <td>{m.name}</td>
                  <td className="dashboard-state-cell">
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

function RecentRequestsPanel({ requests }: { requests: Array<ApiRequest> | null }) {
  const navigate = useNavigate()
  const errCount = useMemo(() => requests?.filter((r) => r.statusCode >= 400).length ?? 0, [requests])
  const maxDuration = useMemo(() => Math.max(0, ...(requests?.map((r) => r.durationMs) ?? [])), [requests])

  return (
    <section className="panel dashboard-panel dashboard-recent-panel">
      <div className="panel-head dashboard-panel-head">
        <span className="panel-title">Recent requests</span>
        <span className="panel-sub">
          newest first · {requests?.length ?? 0} shown{errCount > 0 ? ` · ${errCount} errors` : ''}
        </span>
        <Link to="/requests" className="dashboard-panel-link" style={{ marginLeft: 'auto' }}>
          view all
          <ChevronRight className="icon-btn-12" strokeWidth={2} aria-hidden="true" />
        </Link>
      </div>
      {requests == null ? (
        <div className="empty-state dashboard-empty-state">loading…</div>
      ) : requests.length === 0 ? (
        <div className="empty-state dashboard-empty-state">
          no requests yet. point clients at{' '}
          <CopyableCode text={`${typeof window !== 'undefined' ? window.location.origin : ''}/v1/`} /> to see them here.
        </div>
      ) : (
        <table className="dtable dashboard-table dashboard-requests-table">
          <thead>
            <tr>
              <th className="mono" style={{ width: 80 }}>
                t
              </th>
              <th className="mono">endpoint</th>
              <th>model</th>
              <th style={{ width: 80 }}>status</th>
              <th className="num" style={{ width: 80 }}>
                tok-in
              </th>
              <th className="num" style={{ width: 80, whiteSpace: 'nowrap' }}>
                tok-out
              </th>
              <th className="num" style={{ width: 90 }}>
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
                  <DurationBar ms={r.durationMs} maxMs={maxDuration} isErr={r.statusCode >= 400} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}

function formatMiBGb(value: number | null | undefined) {
  if (value == null) return '—'
  return (value / 1024).toFixed(1)
}

function formatDurationMinutes(ms: number) {
  if (ms <= 0) return '0m'
  const mins = Math.round(ms / 60_000)
  return `${mins}m`
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
