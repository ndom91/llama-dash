import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { ChevronRight, Pencil } from 'lucide-react'
import { useRef, useMemo, useState } from 'react'
import { DurationBar } from '../components/DurationBar'
import { Sparkline } from '../components/Sparkline'
import { StatusCell } from '../components/StatusCell'
import { StatusDot } from '../components/StatusDot'
import { TopBar } from '../components/TopBar'
import type { ApiKeyDetail, ApiKeyModelBreakdown, ApiKeyStats, ApiRequest } from '../lib/api'
import { useKeyDetail, useRenameApiKey } from '../lib/queries'

export const Route = createFileRoute('/keys/$id')({ component: KeyDetailPage })

function KeyDetailPage() {
  const { id } = Route.useParams()
  const { data, error } = useKeyDetail(id)

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
            <KeyContent data={data} />
          )}
        </div>
      </div>
    </div>
  )
}

function KeyContent({ data }: { data: ApiKeyDetail }) {
  const { key, stats, requests, modelBreakdown } = data
  const isRevoked = key.disabledAt != null
  const renameKey = useRenameApiKey()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(key.name)
  const inputRef = useRef<HTMLInputElement>(null)

  const startEdit = () => {
    if (isRevoked) return
    setDraft(key.name)
    setEditing(true)
    setTimeout(() => inputRef.current?.select(), 0)
  }

  const commitRename = () => {
    const trimmed = draft.trim()
    if (!trimmed || trimmed === key.name) {
      setEditing(false)
      return
    }
    renameKey.mutate({ id: key.id, name: trimmed }, { onSuccess: () => setEditing(false) })
  }

  return (
    <>
      <div className="detail-breadcrumb">
        <Link to="/keys">Keys</Link>
        <span>/</span>
        <span style={{ color: 'var(--fg-muted)' }}>{key.name}</span>
      </div>

      <div className="detail-hero">
        <div className="detail-endpoint">
          <div className="detail-endpoint-row">
            <StatusDot tone={isRevoked ? 'idle' : 'ok'} live={!isRevoked} />
            {editing ? (
              <input
                ref={inputRef}
                className="ml-2 bg-transparent border border-accent rounded px-1.5 py-0.5 font-mono text-[22px] font-semibold tracking-tight text-fg outline-none"
                type="text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commitRename}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitRename()
                  if (e.key === 'Escape') setEditing(false)
                }}
              />
            ) : (
              <button
                type="button"
                className="group inline-flex items-center gap-1.5 ml-2 cursor-pointer bg-transparent border-none font-mono text-[22px] font-semibold tracking-tight text-fg"
                onClick={startEdit}
                disabled={isRevoked}
              >
                {key.name}
                {!isRevoked ? (
                  <Pencil
                    size={13}
                    strokeWidth={2}
                    className="text-fg-faint opacity-0 group-hover:opacity-100 transition-opacity"
                  />
                ) : null}
              </button>
            )}
          </div>
          <div className="detail-endpoint-meta">
            ↳ <span className="mono">{key.keyPrefix}…</span>
            <span> · </span>
            <span>{isRevoked ? 'revoked' : 'active'}</span>
            <span> · created </span>
            <span>{new Date(key.createdAt).toLocaleDateString()}</span>
          </div>
        </div>
        <div className="detail-stats-strip">
          <div className="detail-stat">
            <span className="detail-stat-label">models</span>
            <span className="detail-stat-value">
              {key.allowedModels.length === 0 ? 'all' : key.allowedModels.length}
            </span>
          </div>
          {key.rateLimitRpm != null ? (
            <div className="detail-stat">
              <span className="detail-stat-label">rpm</span>
              <span className="detail-stat-value">{key.rateLimitRpm.toLocaleString()}</span>
            </div>
          ) : null}
          {key.rateLimitTpm != null ? (
            <div className="detail-stat">
              <span className="detail-stat-label">tpm</span>
              <span className="detail-stat-value">{key.rateLimitTpm.toLocaleString()}</span>
            </div>
          ) : null}
          {key.monthlyTokenQuota != null ? (
            <div className="detail-stat">
              <span className="detail-stat-label">monthly quota</span>
              <span className="detail-stat-value">{key.monthlyTokenQuota.toLocaleString()}</span>
            </div>
          ) : null}
        </div>
      </div>

      <StatsRow stats={stats} />

      {modelBreakdown.length > 0 ? <ModelBreakdownPanel breakdown={modelBreakdown} /> : null}

      <RequestsPanel rows={requests.rows} />
    </>
  )
}

function StatsRow({ stats }: { stats: ApiKeyStats }) {
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
        <div className="stat-card-label">tokens · 30m</div>
        <div className="stat-card-row">
          <span className="stat-card-value">
            {(stats.totalPromptTokens + stats.totalCompletionTokens).toLocaleString()}
          </span>
        </div>
        <Sparkline data={stats.sparklines.toks} height={32} />
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
      </div>
    </div>
  )
}

function ModelBreakdownPanel({ breakdown }: { breakdown: Array<ApiKeyModelBreakdown> }) {
  return (
    <section className="panel">
      <div className="panel-head">
        <span className="panel-title">Usage by model</span>
        <span className="panel-sub">· last 30m</span>
      </div>
      <table className="dtable">
        <thead>
          <tr>
            <th>model</th>
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
            <tr key={b.model ?? '_unknown'}>
              <td className="mono">
                {b.model ? (
                  <Link to="/models/$id" params={{ id: b.model }}>
                    {b.model}
                  </Link>
                ) : (
                  <span className="dim">unknown</span>
                )}
              </td>
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

function RequestsPanel({ rows }: { rows: Array<ApiRequest> }) {
  const navigate = useNavigate()
  const maxDuration = useMemo(() => Math.max(0, ...rows.map((r) => r.durationMs)), [rows])

  return (
    <section className="panel">
      <div className="panel-head">
        <span className="panel-title">Recent requests</span>
        <span className="panel-sub">· last 20</span>
        <Link to="/requests" className="btn btn-ghost btn-xs" style={{ marginLeft: 'auto' }}>
          view all
          <ChevronRight className="icon-btn-12" strokeWidth={2} aria-hidden="true" />
        </Link>
      </div>
      {rows.length === 0 ? (
        <div className="empty-state">no requests for this key yet.</div>
      ) : (
        <table className="dtable">
          <thead>
            <tr>
              <th className="mono" style={{ width: 80 }}>
                t
              </th>
              <th className="mono">endpoint</th>
              <th className="mono">model</th>
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
                <td className="mono dim">{r.model ?? '—'}</td>
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
