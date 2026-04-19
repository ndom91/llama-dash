import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Check, Copy, KeyRound, Plus, ShieldAlert, Trash2, X } from 'lucide-react'
import { useCallback, useState } from 'react'
import { CopyableCode } from '../components/CopyableCode'
import { PageHeader } from '../components/PageHeader'
import { StatusDot } from '../components/StatusDot'
import { Tooltip } from '../components/Tooltip'
import { TopBar } from '../components/TopBar'
import type { ApiKeyCreated, ApiKeyItem } from '../lib/api'
import { useApiKeys, useCreateApiKey, useDeleteApiKey, useModels, useRevokeApiKey } from '../lib/queries'

export const Route = createFileRoute('/keys/')({ component: Keys })

function Keys() {
  const { data: keys, error, isLoading } = useApiKeys()
  const [showCreate, setShowCreate] = useState(false)
  const [created, setCreated] = useState<ApiKeyCreated | null>(null)

  return (
    <div className="main-col">
      <TopBar />
      <div className="content">
        <div className="page">
          <PageHeader
            kicker="§07 · auth"
            title="API Keys"
            subtitle="manage proxy authentication and rate limits"
            action={
              <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>
                <Plus size={14} strokeWidth={2} />
                Create key
              </button>
            }
          />

          {error ? <div className="err-banner">{error.message}</div> : null}

          {created ? <KeyCreatedBanner created={created} onDismiss={() => setCreated(null)} /> : null}

          {showCreate ? (
            <CreateKeyForm
              onCreated={(result) => {
                setCreated(result)
                setShowCreate(false)
              }}
              onCancel={() => setShowCreate(false)}
            />
          ) : null}

          <section className="panel">
            {isLoading ? (
              <div className="empty-state">loading…</div>
            ) : !keys || keys.length === 0 ? (
              <EmptyKeys />
            ) : (
              <table className="dtable">
                <thead>
                  <tr>
                    <th style={{ width: 18 }} aria-label="status" />
                    <th>name</th>
                    <th className="mono">prefix</th>
                    <th className="hide-mobile">models</th>
                    <th className="num hide-mobile">rpm</th>
                    <th className="num hide-mobile">tpm</th>
                    <th className="hide-mobile">created</th>
                    <th style={{ width: 90 }} className="num">
                      actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {keys.map((k) => (
                    <KeyRow key={k.id} apiKey={k} />
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}

function EmptyKeys() {
  return (
    <div className="empty-state" style={{ padding: '32px 24px' }}>
      <ShieldAlert size={28} strokeWidth={1.5} style={{ color: 'var(--fg-dim)', marginBottom: 8 }} />
      <div style={{ marginBottom: 4 }}>No API keys configured</div>
      <div style={{ fontSize: 12, color: 'var(--fg-dim)' }}>
        The proxy is currently open — all requests pass through unauthenticated. Create a key to enable auth.
      </div>
    </div>
  )
}

function KeyCreatedBanner({ created, onDismiss }: { created: ApiKeyCreated; onDismiss: () => void }) {
  const [copied, setCopied] = useState(false)

  const copy = useCallback(() => {
    navigator.clipboard.writeText(created.rawKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [created.rawKey])

  return (
    <div className="key-created-banner">
      <div className="key-created-header">
        <Check size={16} strokeWidth={2} style={{ color: 'var(--ok)' }} />
        <strong>Key created — copy it now, it won't be shown again</strong>
        <button type="button" className="btn btn-ghost btn-icon" onClick={onDismiss} style={{ marginLeft: 'auto' }}>
          <X size={14} strokeWidth={2} />
        </button>
      </div>
      <div className="key-created-value">
        <code className="mono">{created.rawKey}</code>
        <Tooltip label={copied ? 'Copied' : 'Copy'}>
          <button type="button" className="btn btn-ghost btn-icon" onClick={copy}>
            {copied ? <Check size={14} strokeWidth={2} /> : <Copy size={14} strokeWidth={2} />}
          </button>
        </Tooltip>
      </div>
    </div>
  )
}

function CreateKeyForm({ onCreated, onCancel }: { onCreated: (r: ApiKeyCreated) => void; onCancel: () => void }) {
  const createKey = useCreateApiKey()
  const { data: models } = useModels()
  const [name, setName] = useState('')
  const [allowedModels, setAllowedModels] = useState<Array<string>>([])
  const [rpm, setRpm] = useState('')
  const [tpm, setTpm] = useState('')

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    createKey.mutate(
      {
        name: name.trim(),
        allowedModels,
        rateLimitRpm: rpm ? Number(rpm) : null,
        rateLimitTpm: tpm ? Number(tpm) : null,
      },
      { onSuccess: (data) => onCreated(data) },
    )
  }

  const toggleModel = (id: string) => {
    setAllowedModels((prev) => (prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]))
  }

  return (
    <form className="key-create-form panel" onSubmit={submit}>
      <div className="key-create-form-header">
        <KeyRound size={16} strokeWidth={2} />
        <strong>New API key</strong>
      </div>

      <div className="key-create-fields">
        <label className="key-field">
          <span className="key-field-label">Name</span>
          <input
            className="key-field-input"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. open-webui, my-app"
          />
        </label>

        <div className="key-field">
          <span className="key-field-label">Allowed models</span>
          <span className="key-field-hint">empty = all models</span>
          <div className="key-model-chips">
            {models?.map((m) => (
              <button
                key={m.id}
                type="button"
                className={`key-model-chip${allowedModels.includes(m.id) ? ' is-active' : ''}`}
                onClick={() => toggleModel(m.id)}
              >
                {m.id}
              </button>
            ))}
          </div>
        </div>

        <div className="key-field-row">
          <label className="key-field">
            <span className="key-field-label">RPM limit</span>
            <input
              className="key-field-input"
              type="number"
              min={1}
              value={rpm}
              onChange={(e) => setRpm(e.target.value)}
              placeholder="unlimited"
            />
          </label>
          <label className="key-field">
            <span className="key-field-label">TPM limit</span>
            <input
              className="key-field-input"
              type="number"
              min={1}
              value={tpm}
              onChange={(e) => setTpm(e.target.value)}
              placeholder="unlimited"
            />
          </label>
        </div>
      </div>

      <div className="key-create-actions">
        <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary btn-sm" disabled={!name.trim() || createKey.isPending}>
          {createKey.isPending ? 'Creating…' : 'Create'}
        </button>
      </div>
    </form>
  )
}

function KeyRow({ apiKey }: { apiKey: ApiKeyItem }) {
  const navigate = useNavigate()
  const revokeKey = useRevokeApiKey()
  const deleteKey = useDeleteApiKey()
  const isRevoked = apiKey.disabledAt != null

  return (
    <tr
      className={`clickable-row${isRevoked ? ' row-revoked' : ''}`}
      onClick={() => navigate({ to: '/keys/$id', params: { id: apiKey.id } })}
    >
      <td>
        <StatusDot tone={isRevoked ? 'idle' : 'ok'} live={!isRevoked} />
      </td>
      <td>{apiKey.name}</td>
      <td className="mono">
        <CopyableCode text={`${apiKey.keyPrefix}…`} />
      </td>
      <td className="hide-mobile">
        {apiKey.allowedModels.length === 0 ? (
          <span className="dim">all</span>
        ) : (
          <span className="mono" style={{ fontSize: 11 }}>
            {apiKey.allowedModels.join(', ')}
          </span>
        )}
      </td>
      <td className="num mono hide-mobile">{apiKey.rateLimitRpm ?? <span className="dim">—</span>}</td>
      <td className="num mono hide-mobile">{apiKey.rateLimitTpm ?? <span className="dim">—</span>}</td>
      <td className="hide-mobile" style={{ fontSize: 12, color: 'var(--fg-dim)' }}>
        {new Date(apiKey.createdAt).toLocaleDateString()}
      </td>
      <td className="num">
        {isRevoked ? (
          <Tooltip label="Delete permanently">
            <button
              type="button"
              className="btn btn-danger-ghost btn-xs"
              onClick={(e) => {
                e.stopPropagation()
                deleteKey.mutate(apiKey.id)
              }}
              disabled={deleteKey.isPending}
            >
              <Trash2 className="icon-btn-12" strokeWidth={2} />
              delete
            </button>
          </Tooltip>
        ) : (
          <Tooltip label="Revoke this key">
            <button
              type="button"
              className="btn btn-xs"
              onClick={(e) => {
                e.stopPropagation()
                revokeKey.mutate(apiKey.id)
              }}
              disabled={revokeKey.isPending}
            >
              {revokeKey.isPending ? 'revoking…' : 'revoke'}
            </button>
          </Tooltip>
        )}
      </td>
    </tr>
  )
}
