import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { ChevronRight, Play, Power } from 'lucide-react'
import { useMemo } from 'react'
import { DurationBar } from '../components/DurationBar'
import { PageHeader } from '../components/PageHeader'
import { Sparkline } from '../components/Sparkline'
import { StatusCell } from '../components/StatusCell'
import { StatusDot, stateTone } from '../components/StatusDot'
import { TopBar } from '../components/TopBar'
import type { ApiModelDetail, ApiModelStats, ApiRequest } from '../lib/api'
import { useLoadModel, useModelDetail, useUnloadModel } from '../lib/queries'

export const Route = createFileRoute('/models/$id')({ component: ModelDetailPage })

function ModelDetailPage() {
  const { id } = Route.useParams()
  const { data, error } = useModelDetail(id)

  return (
    <div className="main-col">
      <TopBar />
      <div className="content">
        <div className="page detail-page detail-page-sidecar model-detail-page">
          {error ? (
            <div className="err-banner">{error.message}</div>
          ) : data == null ? (
            <div className="empty-state">loading…</div>
          ) : (
            <ModelContent data={data} />
          )}
        </div>
      </div>
    </div>
  )
}

function ModelContent({ data }: { data: ApiModelDetail }) {
  const { model, events, stats, requests, configSnippet } = data
  const loadModel = useLoadModel()
  const unloadModel = useUnloadModel()
  const tone = model.kind === 'peer' ? ('warn' as const) : stateTone(model.state, model.running)
  const configMeta = useMemo(() => parseModelConfigSnippet(configSnippet), [configSnippet])

  return (
    <>
      <PageHeader
        kicker={`mdl · ${model.name.toLowerCase()}`}
        title={model.name}
        subtitle={
          <span translate="no">
            {model.id} · {model.kind}
          </span>
        }
        variant="integrated"
        action={
          <div className="detail-header-actions">
            {model.kind === 'local' ? (
              model.running ? (
                <button
                  type="button"
                  className="btn btn-ghost btn-xs"
                  onClick={() => unloadModel.mutate(model.id)}
                  disabled={unloadModel.isPending}
                >
                  <Power className="icon-btn-12" strokeWidth={2} aria-hidden="true" />
                  {unloadModel.isPending ? 'unloading…' : 'unload'}
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-xs"
                  onClick={() => loadModel.mutate(model.id)}
                  disabled={loadModel.isPending}
                >
                  <Play className="icon-btn-12" strokeWidth={2} aria-hidden="true" />
                  {loadModel.isPending ? 'loading…' : 'load'}
                </button>
              )
            ) : null}
          </div>
        }
      />

      <div className="detail-sidecar-shell">
        <aside className="detail-meta-rail">
          <div className="detail-meta-section">
            <div className="detail-meta-kicker">Summary</div>
            <dl className="detail-meta-list">
              <div>
                <dt>state</dt>
                <dd>
                  <StatusDot tone={tone} live={model.running} />
                  <span>{model.kind === 'peer' ? 'peer' : model.state}</span>
                </dd>
              </div>
              <div>
                <dt>kind</dt>
                <dd>{model.kind}</dd>
              </div>
              <div>
                <dt>ctx</dt>
                <dd>{configMeta.ctxSize ?? '—'}</dd>
              </div>
              <div>
                <dt>ttl</dt>
                <dd>{model.ttl != null ? formatTtl(model.ttl) : '—'}</dd>
              </div>
              <div>
                <dt>port</dt>
                <dd>{configMeta.port ?? '—'}</dd>
              </div>
            </dl>
          </div>

          {configMeta.aliases.length > 0 ? (
            <div className="detail-meta-section">
              <div className="detail-meta-kicker">Aliases</div>
              <div className="detail-meta-links">
                {configMeta.aliases.map((alias) => (
                  <span key={alias} className="detail-meta-link">
                    {alias}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </aside>

        <div className="detail-main-stack detail-model-main">
          <StatsRow stats={stats} />

          {events.length > 0 ? <EventsPanel events={events} /> : null}

          <RequestsPanel rows={requests.rows} modelId={model.id} />
        </div>

        <aside className="detail-sidecar detail-sidecar-dark detail-model-sidecar">
          {configSnippet ? (
            <section className="detail-sidecar-section">
              <div className="detail-sidecar-title">Command</div>
              <pre className="detail-sidecar-code">{configSnippet}</pre>
            </section>
          ) : null}

          <section className="detail-sidecar-section">
            <div className="detail-sidecar-title">Resident</div>
            <dl className="detail-sidecar-metrics">
              <div>
                <dt>kind</dt>
                <dd>{model.kind}</dd>
              </div>
              <div>
                <dt>ttl</dt>
                <dd>{model.ttl != null ? formatTtl(model.ttl) : '—'}</dd>
              </div>
              <div>
                <dt>ctx</dt>
                <dd>{configMeta.ctxSize ?? '—'}</dd>
              </div>
              <div>
                <dt>port</dt>
                <dd>{configMeta.port ?? '—'}</dd>
              </div>
            </dl>
          </section>

          <section className="detail-sidecar-section detail-sidecar-danger">
            <div className="detail-sidecar-title">Actions</div>
            <Link to="/playground" className="btn btn-sm">
              Open in Playground
            </Link>
            <Link to="/config" className="btn btn-sm">
              Edit in config.yaml
            </Link>
            {model.kind === 'local' ? (
              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={() => unloadModel.mutate(model.id)}
                disabled={!model.running || unloadModel.isPending}
              >
                Unload
              </button>
            ) : null}
          </section>
        </aside>
      </div>
    </>
  )
}

function StatsRow({ stats }: { stats: ApiModelStats }) {
  return (
    <div className="stats-row detail-stacked-section detail-stacked-stats-row">
      <div className="stat-card">
        <div className="stat-card-label">requests · 30m</div>
        <div className="stat-card-row">
          <span className="stat-card-value">{stats.totalRequests.toLocaleString()}</span>
        </div>
        <Sparkline data={stats.sparklines.reqs} height={32} />
      </div>
      <div className="stat-card">
        <div className="stat-card-label">error rate</div>
        <div className="stat-card-row">
          <span className="stat-card-value">{stats.errorRate.toFixed(1)}</span>
          <span className="stat-card-unit">percent</span>
        </div>
      </div>
      <div className="stat-card">
        <div className="stat-card-label">avg duration</div>
        <div className="stat-card-row">
          <span className="stat-card-value">{formatDuration(stats.avgDurationMs)}</span>
        </div>
      </div>
      <div className="stat-card">
        <div className="stat-card-label">avg tok/s</div>
        <div className="stat-card-row">
          <span className="stat-card-value">{stats.avgTokPerSec.toLocaleString()}</span>
          <span className="stat-card-unit">tok-sec</span>
        </div>
        <Sparkline data={stats.sparklines.toks} height={32} />
      </div>
    </div>
  )
}

function EventsPanel({ events }: { events: Array<{ id: string; event: string; timestamp: string }> }) {
  const recentEvents = events.slice(0, 12)

  return (
    <section className="panel detail-stacked-section">
      <div className="panel-head">
        <span className="panel-title">History</span>
        <span className="panel-sub">· latest 12 load/unload events</span>
      </div>
      <table className="dtable">
        <thead>
          <tr>
            <th style={{ width: 18 }} aria-label="type" />
            <th style={{ width: 160 }}>time</th>
            <th>event</th>
          </tr>
        </thead>
        <tbody>
          {recentEvents.map((e) => (
            <tr key={e.id}>
              <td>
                <StatusDot tone={e.event === 'load' ? 'ok' : 'idle'} />
              </td>
              <td className="mono dim">{new Date(e.timestamp).toLocaleString([], { hour12: false })}</td>
              <td>{e.event}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

function RequestsPanel({ rows, modelId }: { rows: Array<ApiRequest>; modelId: string }) {
  const navigate = useNavigate()
  const maxDuration = useMemo(() => Math.max(0, ...rows.map((r) => r.durationMs)), [rows])

  return (
    <section className="panel detail-stacked-section">
      <div className="panel-head">
        <span className="panel-title">Recent requests</span>
        <span className="panel-sub">· last 20</span>
        <Link
          to="/requests"
          search={{ model: modelId }}
          className="btn btn-ghost btn-xs"
          style={{ marginLeft: 'auto' }}
        >
          view all
          <ChevronRight className="icon-btn-12" strokeWidth={2} aria-hidden="true" />
        </Link>
      </div>
      {rows.length === 0 ? (
        <div className="empty-state">no requests for this model yet.</div>
      ) : (
        <table className="dtable">
          <thead>
            <tr>
              <th className="mono" style={{ width: 80 }}>
                t
              </th>
              <th className="mono">endpoint</th>
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
            {rows.map((r) => (
              <tr
                key={r.id}
                className="clickable-row"
                onClick={() => navigate({ to: '/requests/$id', params: { id: r.id } })}
              >
                <td className="mono dim">{new Date(r.startedAt).toLocaleTimeString([], { hour12: false })}</td>
                <td className="mono" translate="no">
                  {r.endpoint}
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

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  const s = ms / 1000
  if (s < 60) return `${s.toFixed(s < 10 ? 2 : 1)}s`
  const m = Math.floor(s / 60)
  const rem = Math.floor(s % 60)
  return `${m}m ${rem}s`
}

function formatTtl(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return s > 0 ? `${m}m ${s}s` : `${m}m`
}

function parseModelConfigSnippet(snippet: string | null) {
  if (!snippet) return { aliases: [] as Array<string>, ctxSize: null as string | null, port: null as string | null }

  const aliasesMatch = snippet.match(/aliases:\s*\[([^\]]+)\]/)
  const ctxMatch = snippet.match(/--ctx-size\s+(\d+)/)
  const portMatch = snippet.match(/--port\s+(\$\{PORT\}|\d+)/)

  return {
    aliases: aliasesMatch ? aliasesMatch[1].split(',').map((part) => part.trim()) : [],
    ctxSize: ctxMatch ? Number(ctxMatch[1]).toLocaleString() : null,
    port: portMatch ? portMatch[1] : null,
  }
}
