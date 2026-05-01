import { Check, Copy, PenLine, Power, RotateCw, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { PageHeader } from '../../components/PageHeader'
import { StatusDot } from '../../components/StatusDot'
import { Tooltip } from '../../components/Tooltip'
import type { ApiKeyDetail } from '../../lib/api'
import { cn } from '../../lib/cn'
import { useModels, useRenameApiKey, useRevokeApiKey, useRotateApiKey } from '../../lib/queries'
import { KeyModelAccessPanel } from './KeyModelAccessPanel'
import { KeyRequestsPanel } from './KeyRequestsPanel'
import { KeyStatsRow } from './KeyStatsRow'
import { KeySystemPromptPanel } from './KeySystemPromptPanel'
import { buildKeySnippet, formatRelative } from './keyUtils'

type Props = {
  data: ApiKeyDetail
}

export function KeyDetailContent({ data }: Props) {
  const { key, stats, requests, modelBreakdown } = data
  const { data: models } = useModels()
  const isRevoked = key.disabledAt != null
  const renameKey = useRenameApiKey()
  const revokeKey = useRevokeApiKey()
  const rotateKey = useRotateApiKey()
  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState(key.name)
  const nameInputRef = useRef<HTMLInputElement>(null)
  const [confirmRotate, setConfirmRotate] = useState(false)
  const [rotatedRawKey, setRotatedRawKey] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const lastUsedAt = requests.rows[0]?.startedAt ?? null
  const scopedModels =
    key.allowedModels.length === 0 ? 'all' : `${key.allowedModels.length} of ${models?.length ?? '—'}`

  useEffect(() => {
    if (!editingName) return
    nameInputRef.current?.focus()
    nameInputRef.current?.select()
  }, [editingName])

  const startRename = () => {
    setNameDraft(key.name)
    setEditingName(true)
  }

  const cancelRename = () => {
    setNameDraft(key.name)
    setEditingName(false)
  }

  const saveRename = () => {
    const next = nameDraft.trim()
    if (!next || next === key.name) {
      cancelRename()
      return
    }
    renameKey.mutate(
      { id: key.id, name: next },
      {
        onSuccess: () => setEditingName(false),
      },
    )
  }

  const copyRotatedKey = useCallback(() => {
    if (!rotatedRawKey) return
    navigator.clipboard.writeText(rotatedRawKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [rotatedRawKey])

  const rotate = () => {
    rotateKey.mutate(key.id, {
      onSuccess: (result) => {
        setRotatedRawKey(result.rawKey)
        setConfirmRotate(false)
      },
    })
  }

  return (
    <>
      <PageHeader
        kicker={`key · ${key.name}`}
        title={key.name}
        titleNode={
          editingName ? (
            <input
              className="h-8 w-[min(360px,60vw)] rounded border border-border bg-surface-3 px-2.5 text-xl font-semibold -tracking-[0.015em] text-fg outline-none transition-[border-color,box-shadow] focus:border-accent focus:shadow-focus"
              value={nameDraft}
              ref={nameInputRef}
              disabled={renameKey.isPending}
              onChange={(event) => setNameDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') saveRename()
                if (event.key === 'Escape') cancelRename()
              }}
            />
          ) : (
            <h1 className="page-header-title m-0 text-xl font-semibold -tracking-[0.015em] text-fg">{key.name}</h1>
          )
        }
        subtitle={
          <>
            <span translate="no">
              {key.keyPrefix}… · {isRevoked ? 'revoked' : 'active'} · created{' '}
              {new Date(key.createdAt).toLocaleDateString()}
            </span>
            {rotatedRawKey ? (
              <div className="mt-4 mb-1 rounded border border-ok bg-ok-bg px-4 py-3 font-sans text-fg">
                <div className="mb-2 flex items-center gap-2 text-[13px]">
                  <Check size={16} strokeWidth={2} className="text-ok" />
                  <strong>Key rotated — copy the new secret now, it won't be shown again</strong>
                  <button
                    type="button"
                    className="btn btn-ghost btn-icon ml-auto"
                    onClick={() => setRotatedRawKey(null)}
                    aria-label="Dismiss rotated API key secret"
                  >
                    <X size={14} strokeWidth={2} />
                  </button>
                </div>
                <div className="flex items-center gap-2 rounded-sm border border-border bg-surface-1 px-3 py-2">
                  <code className="mono flex-1 break-all text-xs">{rotatedRawKey}</code>
                  <Tooltip label={copied ? 'Copied' : 'Copy'}>
                    <button
                      type="button"
                      className="btn btn-ghost btn-icon"
                      onClick={copyRotatedKey}
                      aria-label={copied ? 'Copied rotated API key' : 'Copy rotated API key'}
                    >
                      <span className={cn('copy-icon-swap', copied && 'copy-icon-swap-done')}>
                        <Copy className="copy-icon-swap-from" size={14} strokeWidth={2} />
                        <Check className="copy-icon-swap-to text-ok" size={14} strokeWidth={2} />
                      </span>
                    </button>
                  </Tooltip>
                </div>
              </div>
            ) : null}
          </>
        }
        variant="integrated"
        action={
          <div className="relative flex items-center gap-2">
            {editingName ? (
              <div className="flex items-center overflow-hidden rounded border border-border bg-surface-2">
                <button
                  type="button"
                  className="border-border border-r px-2 py-1 font-mono text-[11px] font-medium text-accent transition-colors hover:bg-surface-3 disabled:opacity-50"
                  onClick={saveRename}
                  disabled={renameKey.isPending || !nameDraft.trim()}
                >
                  save
                </button>
                <button
                  type="button"
                  className="px-2 py-1 font-mono text-[11px] font-medium text-fg-dim transition-colors hover:bg-surface-3 hover:text-fg disabled:opacity-50"
                  onClick={cancelRename}
                  disabled={renameKey.isPending}
                >
                  cancel
                </button>
              </div>
            ) : (
              <button type="button" className="btn btn-ghost btn-xs" disabled={isRevoked} onClick={startRename}>
                <PenLine size={12} strokeWidth={2} />
                rename
              </button>
            )}
            <button
              type="button"
              className="btn btn-ghost btn-xs"
              disabled={isRevoked || rotateKey.isPending}
              onClick={() => setConfirmRotate(true)}
            >
              <RotateCw size={12} strokeWidth={2} />
              {rotateKey.isPending ? 'rotating…' : 'rotate'}
            </button>
            {confirmRotate ? (
              <div className="absolute right-0 top-full z-20 mt-2 w-[280px] rounded border border-border-strong bg-surface-1 p-3 shadow-lg">
                <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-warn">Rotate API key</div>
                <p className="my-2 text-xs leading-5 text-fg-dim">
                  This immediately invalidates the current secret. Existing clients using it will fail until updated.
                </p>
                <div className="flex justify-end gap-2">
                  <button type="button" className="btn btn-ghost btn-xs" onClick={() => setConfirmRotate(false)}>
                    cancel
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary btn-xs"
                    onClick={rotate}
                    disabled={rotateKey.isPending}
                  >
                    confirm rotate
                  </button>
                </div>
              </div>
            ) : null}
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
                <dd>
                  <span className="font-mono">{key.keyPrefix}…</span>
                </dd>
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

        <div className="detail-main-stack">
          <KeyStatsRow stats={stats} />
          <KeySystemPromptPanel keyId={key.id} systemPrompt={key.systemPrompt} isRevoked={isRevoked} />
          <KeyModelAccessPanel
            keyId={key.id}
            allowedModels={key.allowedModels}
            breakdown={modelBreakdown}
            isRevoked={isRevoked}
          />
          <KeyRequestsPanel rows={requests.rows} />
        </div>

        <aside className="detail-sidecar bg-surface-2 border-l border-border">
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
