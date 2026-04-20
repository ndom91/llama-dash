import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { ChevronRight, Pencil, Power, RotateCw } from 'lucide-react'
import { useRef, useMemo, useState } from 'react'
import { cn } from '../lib/cn'
import { DurationBar } from '../components/DurationBar'
import { PageHeader } from '../components/PageHeader'
import { Sparkline } from '../components/Sparkline'
import { StatusCell } from '../components/StatusCell'
import { StatusDot } from '../components/StatusDot'
import { TopBar } from '../components/TopBar'
import type { ApiKeyDetail, ApiKeyModelBreakdown, ApiKeyStats, ApiRequest } from '../lib/api'
import {
  useApiKeys,
  useKeyDetail,
  useModels,
  useRevokeApiKey,
  useRenameApiKey,
  useUpdateKeyDefaultModel,
  useUpdateKeyModels,
  useUpdateKeySystemPrompt,
} from '../lib/queries'

export const Route = createFileRoute('/keys/$id')({ component: KeyDetailPage })

function KeyDetailPage() {
  const { id } = Route.useParams()
  const { data, error } = useKeyDetail(id)

  return (
    <div className="main-col">
      <TopBar />
      <div className="content">
        <div className="page detail-page detail-page-sidecar key-detail-page">
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
  const revokeKey = useRevokeApiKey()
  const { data: allKeys } = useApiKeys()
  const renameKey = useRenameApiKey()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(key.name)
  const inputRef = useRef<HTMLInputElement>(null)
  const lastUsedAt = requests.rows[0]?.startedAt ?? null
  const scopedModels = key.allowedModels.length === 0 ? 'all' : `${key.allowedModels.length} of 5`

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
      <PageHeader
        kicker={`key · ${key.name}`}
        title={key.name}
        subtitle={
          <span translate="no">
            {key.keyPrefix}… · {isRevoked ? 'revoked' : 'active'} · created{' '}
            {new Date(key.createdAt).toLocaleDateString()}
          </span>
        }
        variant="integrated"
        action={
          <div className="detail-header-actions">
            <button type="button" className="btn btn-ghost btn-xs" disabled>
              <RotateCw size={12} strokeWidth={2} />
              rotate
            </button>
            <button
              type="button"
              className="btn btn-danger-ghost btn-xs"
              disabled={isRevoked || revokeKey.isPending}
              onClick={() => revokeKey.mutate(key.id)}
            >
              <Power size={12} strokeWidth={2} />
              revoke
            </button>
          </div>
        }
      />

      <div className="detail-sidecar-shell">
        <aside className="detail-meta-rail">
          <div className="detail-meta-section">
            <div className="detail-meta-kicker">Key</div>
            <dl className="detail-meta-list">
              <div>
                <dt>status</dt>
                <dd>
                  <StatusDot tone={isRevoked ? 'idle' : 'ok'} live={!isRevoked} />
                  <span>{isRevoked ? 'revoked' : 'active'}</span>
                </dd>
              </div>
              <div>
                <dt>prefix</dt>
                <dd className="mono">{key.keyPrefix}…</dd>
              </div>
              <div>
                <dt>created</dt>
                <dd>{new Date(key.createdAt).toLocaleDateString()}</dd>
              </div>
              <div>
                <dt>last used</dt>
                <dd>{lastUsedAt ? formatRelative(lastUsedAt) : 'never'}</dd>
              </div>
            </dl>
          </div>

          <div className="detail-meta-section">
            <div className="detail-meta-kicker">Limits</div>
            <dl className="detail-meta-list">
              <div>
                <dt>rpm</dt>
                <dd>{key.rateLimitRpm?.toLocaleString() ?? '—'}</dd>
              </div>
              <div>
                <dt>tpm</dt>
                <dd>{key.rateLimitTpm?.toLocaleString() ?? '—'}</dd>
              </div>
              <div>
                <dt>models</dt>
                <dd>{scopedModels}</dd>
              </div>
            </dl>
          </div>
        </aside>

        <div className="detail-main-stack detail-key-main">
          <StatsRow stats={stats} />

          <DefaultModelPanel keyId={key.id} defaultModel={key.defaultModel} isRevoked={isRevoked} />

          <SystemPromptPanel keyId={key.id} systemPrompt={key.systemPrompt} isRevoked={isRevoked} />

          <ModelAccessPanel
            keyId={key.id}
            allowedModels={key.allowedModels}
            breakdown={modelBreakdown}
            isRevoked={isRevoked}
          />

          <RequestsPanel rows={requests.rows} />
        </div>

        <aside className="detail-sidecar detail-sidecar-dark">
          <section className="detail-sidecar-section">
            <div className="detail-sidecar-title">Use this key</div>
            <pre className="detail-sidecar-code">{buildKeySnippet(key.keyPrefix)}</pre>
          </section>

          <section className="detail-sidecar-section">
            <div className="detail-sidecar-title">Activity · 30m</div>
            <dl className="detail-sidecar-metrics">
              <div>
                <dt>requests</dt>
                <dd>{stats.totalRequests}</dd>
              </div>
              <div>
                <dt>success</dt>
                <dd>{stats.totalRequests - stats.errorCount}</dd>
              </div>
              <div>
                <dt>errors</dt>
                <dd>{stats.errorCount}</dd>
              </div>
              <div>
                <dt>tokens</dt>
                <dd>{(stats.totalPromptTokens + stats.totalCompletionTokens).toLocaleString()}</dd>
              </div>
            </dl>
          </section>
        </aside>
      </div>
    </>
  )
}

function StatsRow({ stats }: { stats: ApiKeyStats }) {
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

function DefaultModelPanel({
  keyId,
  defaultModel,
  isRevoked,
}: {
  keyId: string
  defaultModel: string | null
  isRevoked: boolean
}) {
  const { data: allModels } = useModels()
  const updateDefault = useUpdateKeyDefaultModel()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(defaultModel ?? '')

  const save = () => {
    const val = draft.trim() || null
    if (val === defaultModel) {
      setEditing(false)
      return
    }
    updateDefault.mutate({ id: keyId, defaultModel: val }, { onSuccess: () => setEditing(false) })
  }

  return (
    <section className="panel detail-stacked-section">
      <div className="panel-head">
        <span className="panel-title">Default model</span>
        <span className="panel-sub">· {defaultModel ? `pinned to ${defaultModel}` : 'not set'}</span>
        {!isRevoked && !editing ? (
          <button
            type="button"
            className="btn btn-ghost btn-xs ml-auto"
            onClick={() => {
              setDraft(defaultModel ?? '')
              setEditing(true)
            }}
          >
            {defaultModel ? 'change' : 'set'}
          </button>
        ) : null}
      </div>
      {editing ? (
        <div className="p-4 flex gap-2 items-center">
          <select
            className="bg-surface-3 border border-border rounded px-2 py-1.5 font-mono text-xs text-fg cursor-pointer flex-1"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          >
            <option value="">none (use client's model)</option>
            {allModels?.map((m) => (
              <option key={m.id} value={m.id}>
                {m.id}
              </option>
            ))}
          </select>
          <button type="button" className="btn btn-primary btn-sm" onClick={save} disabled={updateDefault.isPending}>
            Save
          </button>
          <button type="button" className="btn btn-sm" onClick={() => setEditing(false)}>
            Cancel
          </button>
        </div>
      ) : defaultModel ? (
        <div className="p-4">
          <p className="text-xs text-fg-dim font-mono m-0">
            All requests using this key will have their model overridden to{' '}
            <code className="text-fg">{defaultModel}</code>, regardless of what the client sends.
          </p>
        </div>
      ) : (
        <div className="p-4">
          <p className="text-xs text-fg-dim font-mono m-0">
            No default model set. The client's requested model is used as-is.
          </p>
        </div>
      )}
    </section>
  )
}

function SystemPromptPanel({
  keyId,
  systemPrompt,
  isRevoked,
}: {
  keyId: string
  systemPrompt: string | null
  isRevoked: boolean
}) {
  const updatePrompt = useUpdateKeySystemPrompt()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(systemPrompt ?? '')

  const save = () => {
    const val = draft.trim() || null
    if (val === systemPrompt) {
      setEditing(false)
      return
    }
    updatePrompt.mutate({ id: keyId, systemPrompt: val }, { onSuccess: () => setEditing(false) })
  }

  return (
    <section className="panel detail-stacked-section">
      <div className="panel-head">
        <span className="panel-title">System prompt</span>
        <span className="panel-sub">· {systemPrompt ? 'active' : 'not set'}</span>
        {!isRevoked && !editing ? (
          <button
            type="button"
            className="btn btn-ghost btn-xs ml-auto"
            onClick={() => {
              setDraft(systemPrompt ?? '')
              setEditing(true)
            }}
          >
            {systemPrompt ? 'edit' : 'set'}
          </button>
        ) : null}
      </div>
      {editing ? (
        <div className="p-4 flex flex-col gap-2">
          <textarea
            className="bg-surface-3 border border-border rounded px-3 py-2 font-mono text-xs text-fg resize-y min-h-[80px]"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={10000}
            placeholder="Enter a system prompt to prepend to all chat completion requests..."
          />
          <div className="flex gap-2">
            <button type="button" className="btn btn-primary btn-xs" onClick={save} disabled={updatePrompt.isPending}>
              Save
            </button>
            <button type="button" className="btn btn-xs" onClick={() => setEditing(false)}>
              Cancel
            </button>
            {systemPrompt ? (
              <button
                type="button"
                className="btn btn-xs btn-danger ml-auto"
                onClick={() => {
                  updatePrompt.mutate({ id: keyId, systemPrompt: null }, { onSuccess: () => setEditing(false) })
                }}
                disabled={updatePrompt.isPending}
              >
                Remove
              </button>
            ) : null}
          </div>
        </div>
      ) : systemPrompt ? (
        <div className="p-4">
          <pre className="bg-surface-3 border border-border rounded p-3 font-mono text-xs text-fg whitespace-pre-wrap m-0 max-h-[200px] overflow-y-auto">
            {systemPrompt}
          </pre>
        </div>
      ) : (
        <div className="p-4">
          <p className="text-xs text-fg-dim font-mono m-0">
            No system prompt configured. Set one to prepend a system message to all chat completion requests using this
            key.
          </p>
        </div>
      )}
    </section>
  )
}

function ModelAccessPanel({
  keyId,
  allowedModels,
  breakdown,
  isRevoked,
}: {
  keyId: string
  allowedModels: Array<string>
  breakdown: Array<ApiKeyModelBreakdown>
  isRevoked: boolean
}) {
  const { data: allModels } = useModels()
  const updateModels = useUpdateKeyModels()
  const allowAll = allowedModels.length === 0
  const breakdownByModel = useMemo(() => {
    const map = new Map<string, ApiKeyModelBreakdown>()
    for (const b of breakdown) {
      if (!b.model) continue
      map.set(b.model, b)
      const bare = b.model.includes('/') ? b.model.split('/').pop()! : b.model
      if (bare !== b.model) map.set(bare, b)
    }
    return map
  }, [breakdown])

  const toggleModel = (modelId: string) => {
    if (isRevoked || allowAll) return
    const next = allowedModels.includes(modelId)
      ? allowedModels.filter((m) => m !== modelId)
      : [...allowedModels, modelId]
    updateModels.mutate({ id: keyId, allowedModels: next })
  }

  const restrictModels = () => {
    if (isRevoked || !allModels) return
    updateModels.mutate({ id: keyId, allowedModels: allModels.map((m) => m.id) })
  }

  const enableAll = () => {
    if (isRevoked) return
    updateModels.mutate({ id: keyId, allowedModels: [] })
  }

  if (!allModels) return null

  return (
    <section className="panel detail-stacked-section">
      <div className="panel-head">
        <span className="panel-title">Model access</span>
        <span className="panel-sub">
          · {allowAll ? 'all models' : `${allowedModels.length} of ${allModels.length}`}
        </span>
        {!isRevoked ? (
          allowAll ? (
            <button
              type="button"
              className="btn btn-ghost btn-xs ml-auto"
              onClick={restrictModels}
              disabled={updateModels.isPending}
            >
              restrict
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-ghost btn-xs ml-auto"
              onClick={enableAll}
              disabled={updateModels.isPending}
            >
              allow all
            </button>
          )
        ) : null}
      </div>
      <table className="dtable">
        <thead>
          <tr>
            <th style={{ width: 32 }} aria-label="enabled" />
            <th className="mono">model</th>
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
          {allModels.map((m) => {
            const enabled = allowAll || allowedModels.includes(m.id)
            const canToggle = !allowAll && !isRevoked
            const stats = breakdownByModel.get(m.id)
            return (
              <tr key={m.id} className={cn(!enabled && 'opacity-40')}>
                <td>
                  <input
                    type="checkbox"
                    checked={enabled}
                    disabled={!canToggle}
                    onChange={() => toggleModel(m.id)}
                    className="accent-accent size-3.5 cursor-pointer disabled:cursor-default"
                  />
                </td>
                <td className="mono" translate="no">
                  <Link to="/models/$id" params={{ id: m.id }} className={cn(!enabled && 'text-fg-dim')}>
                    {m.id}
                  </Link>
                </td>
                <td className="num">{stats?.requestCount.toLocaleString() ?? '—'}</td>
                <td className="num">{stats?.totalTokens.toLocaleString() ?? '—'}</td>
                <td className="num">
                  {stats && stats.errorCount > 0 ? <span className="text-err">{stats.errorCount}</span> : '—'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </section>
  )
}

function RequestsPanel({ rows }: { rows: Array<ApiRequest> }) {
  const navigate = useNavigate()
  const maxDuration = useMemo(() => Math.max(0, ...rows.map((r) => r.durationMs)), [rows])

  return (
    <section className="panel detail-stacked-section detail-fill-panel">
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

function formatRelative(timestamp: string) {
  const diff = Date.now() - new Date(timestamp).getTime()
  const mins = Math.max(1, Math.round(diff / 60_000))
  if (mins < 60) return `${mins} min ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours} hr ago`
  return `${Math.round(hours / 24)} d ago`
}

function buildKeySnippet(keyPrefix: string) {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://llama-dash.example'

  return `curl ${origin}/v1/\\
  chat/completions \\
  -H "Authorization: Bearer ${keyPrefix}…" \\
  -d '{"model":"gemma-4",\\
    "messages":[…]}'`
}
