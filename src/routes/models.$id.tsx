import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { Check, ChevronRight, Clipboard, Play, Power } from 'lucide-react'
import { useMemo, useState } from 'react'
import { DurationBar } from '../components/DurationBar'
import { Sparkline } from '../components/Sparkline'
import { StatusCell } from '../components/StatusCell'
import { StatusDot, stateTone } from '../components/StatusDot'
import { TopBar } from '../components/TopBar'
import type { ApiModelDetail, ApiModelKeyBreakdown, ApiModelStats, ApiRequest } from '../lib/api'
import { useLoadModel, useModelDetail, useUnloadModel } from '../lib/queries'

export const Route = createFileRoute('/models/$id')({ component: ModelDetailPage })

function ModelDetailPage() {
  const { id } = Route.useParams()
  const { data, error } = useModelDetail(id)

  return (
    <div className="main-col">
      <TopBar />
      <div className="content">
        <div className="page">
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
  const { model, events, stats, requests, configSnippet, keyBreakdown } = data
  const loadModel = useLoadModel()
  const unloadModel = useUnloadModel()
  const tone = model.kind === 'peer' ? ('warn' as const) : stateTone(model.state, model.running)

  return (
    <>
      <div className="detail-breadcrumb">
        <Link to="/models">Models</Link>
        <span>/</span>
        <span style={{ color: 'var(--fg-muted)' }}>{model.name}</span>
      </div>

      <div className="detail-hero">
        <div className="detail-endpoint">
          <div className="detail-endpoint-row">
            <StatusDot tone={tone} live={model.running} />
            <span className="detail-endpoint-method" style={{ marginLeft: 8 }}>
              {model.name}
            </span>
          </div>
          <div className="detail-endpoint-meta">
            ↳ <span className="mono">{model.id}</span>
            <span> · </span>
            <span>{model.kind}</span>
            {model.peerId ? (
              <>
                <span> · peer </span>
                <span className="mono">{model.peerId}</span>
              </>
            ) : null}
          </div>
        </div>
        <div className="detail-stats-strip">
          <div className="detail-stat">
            <span className="detail-stat-label">state</span>
            <span className={`state-label state-label-${tone}`}>{model.kind === 'peer' ? 'peer' : model.state}</span>
          </div>
          {model.ttl != null ? (
            <div className="detail-stat">
              <span className="detail-stat-label">ttl</span>
              <span className="detail-stat-value">{formatTtl(model.ttl)}</span>
            </div>
          ) : null}
          <div className="detail-stat" style={{ marginLeft: 'auto' }}>
            {model.kind === 'local' ? (
              model.running ? (
                <button
                  type="button"
                  className="btn btn-xs"
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
        </div>
      </div>

      <StatsRow stats={stats} />

      {events.length > 0 ? <EventsPanel events={events} /> : null}

      <RequestsPanel rows={requests.rows} modelId={model.id} />

      {keyBreakdown.length > 0 ? <KeyBreakdownPanel breakdown={keyBreakdown} /> : null}

      {configSnippet ? <ConfigPanel snippet={configSnippet} /> : null}
    </>
  )
}

function StatsRow({ stats }: { stats: ApiModelStats }) {
  return (
    <div className="stats-row">
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
  return (
    <section className="panel">
      <div className="panel-head">
        <span className="panel-title">History</span>
        <span className="panel-sub">· load/unload events, last 24h</span>
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
          {events.map((e) => (
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
    <section className="panel">
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

function KeyBreakdownPanel({ breakdown }: { breakdown: Array<ApiModelKeyBreakdown> }) {
  return (
    <section className="panel">
      <div className="panel-head">
        <span className="panel-title">Usage by key</span>
        <span className="panel-sub">· last 30m</span>
      </div>
      <table className="dtable">
        <thead>
          <tr>
            <th>key</th>
            <th className="num" style={{ width: 100 }}>
              requests
            </th>
            <th className="num" style={{ width: 100 }}>
              tokens
            </th>
            <th className="num" style={{ width: 80 }}>
              errors
            </th>
          </tr>
        </thead>
        <tbody>
          {breakdown.map((b) => (
            <tr key={b.keyId ?? '_anon'}>
              <td className="mono">{b.keyName ?? (b.keyId ? b.keyId.slice(0, 12) : 'anonymous')}</td>
              <td className="num">{b.requestCount.toLocaleString()}</td>
              <td className="num">{b.totalTokens.toLocaleString()}</td>
              <td className="num">
                {b.errorCount > 0 ? <span style={{ color: 'var(--err)' }}>{b.errorCount}</span> : '0'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

function ConfigPanel({ snippet }: { snippet: string }) {
  const [copied, setCopied] = useState(false)
  const onCopy = () => {
    navigator.clipboard.writeText(snippet)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <span className="panel-title">Configuration</span>
        <span className="panel-sub">· from config.yaml</span>
        <button type="button" className="btn btn-ghost btn-xs" style={{ marginLeft: 'auto' }} onClick={onCopy}>
          {copied ? (
            <Check className="icon-btn-12" strokeWidth={2} aria-hidden="true" />
          ) : (
            <Clipboard className="icon-btn-12" strokeWidth={2} aria-hidden="true" />
          )}
          {copied ? 'copied' : 'copy'}
        </button>
      </div>
      <pre className="body-pre">{snippet}</pre>
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
