import { Eye, EyeOff, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { CopyableCode } from '../../components/CopyableCode'
import { Tooltip } from '../../components/Tooltip'

export function CredentialVaultPanel({
  credentials,
  vaultEnabled,
  vaultStatus,
  errorMessage,
  createPending,
  deletePending,
  onCreate,
  onDelete,
}: {
  credentials: Array<{
    id: string
    name: string
    slug: string
    type: 'bearer'
    lastUsedAt: string | null
  }>
  vaultEnabled: boolean
  vaultStatus: 'ready' | 'missing_key' | 'key_too_short'
  errorMessage?: string
  createPending: boolean
  deletePending: boolean
  onCreate: (body: { name: string; slug?: string; type: 'bearer'; value: string }) => void
  onDelete: (id: string) => void
}) {
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [value, setValue] = useState('')
  const [showValue, setShowValue] = useState(false)

  const submit = () => {
    if (!name.trim() || !value.trim()) return
    onCreate({
      name: name.trim(),
      slug: slug.trim() || undefined,
      type: 'bearer',
      value: value.trim(),
    })
    setName('')
    setSlug('')
    setValue('')
    setShowValue(false)
  }
  const statusText = errorMessage
    ? 'disabled · credential status unavailable'
    : vaultEnabled
      ? 'encrypted at rest'
      : vaultStatus === 'key_too_short'
        ? 'disabled · CREDENTIAL_ENCRYPTION_KEY must be 32+ chars'
        : 'disabled · set CREDENTIAL_ENCRYPTION_KEY and restart'

  return (
    <section className="rounded-lg border border-border bg-surface-0 px-5 py-5 font-mono text-xs text-fg-dim">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-[10px] uppercase tracking-[0.12em] text-fg-faint">Upstream credential vault</span>
        <span className="text-[10px] uppercase tracking-[0.12em] text-fg-faint">· {statusText}</span>
      </div>
      {errorMessage ? (
        <div className="mb-3 rounded border border-err/40 bg-err/10 px-3 py-2 text-[11px] text-err">
          Failed to load credential vault status: {errorMessage}
        </div>
      ) : null}
      <div className="grid gap-2 lg:grid-cols-[minmax(0,180px)_minmax(0,180px)_minmax(0,1fr)_auto]">
        <input
          type="text"
          className="h-9 rounded border border-border bg-surface-3 px-3 font-mono text-xs text-fg focus-visible:outline-none focus-visible:shadow-focus"
          placeholder="Credential name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          disabled={!vaultEnabled}
        />
        <input
          type="text"
          data-1p-ignore="true"
          data-lpignore="true"
          data-form-type="other"
          className="h-9 rounded border border-border bg-surface-3 px-3 font-mono text-xs text-fg focus-visible:outline-none focus-visible:shadow-focus"
          placeholder="slug (optional)"
          value={slug}
          onChange={(event) => setSlug(event.target.value)}
          disabled={!vaultEnabled}
        />
        <div className="relative min-w-0">
          <input
            type={showValue ? 'text' : 'password'}
            data-1p-ignore="true"
            data-lpignore="true"
            data-form-type="other"
            className="h-9 w-full rounded border border-border bg-surface-3 px-3 pr-10 font-mono text-xs text-fg focus-visible:outline-none focus-visible:shadow-focus"
            placeholder="Bearer token"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            disabled={!vaultEnabled}
          />
          <button
            type="button"
            className="absolute inset-y-0 right-0 flex w-9 items-center justify-center rounded-r text-fg-faint transition-colors hover:text-fg focus-visible:outline-none focus-visible:shadow-focus disabled:cursor-not-allowed disabled:opacity-40"
            onClick={() => setShowValue((visible) => !visible)}
            disabled={!vaultEnabled || !value}
            aria-label={showValue ? 'Hide secret value' : 'Show secret value'}
            aria-pressed={showValue}
          >
            {showValue ? (
              <EyeOff className="size-3.5" strokeWidth={2} aria-hidden="true" />
            ) : (
              <Eye className="size-3.5" strokeWidth={2} aria-hidden="true" />
            )}
          </button>
        </div>
        <button
          type="button"
          className="btn btn-primary h-9 px-3 text-xs"
          onClick={submit}
          disabled={!vaultEnabled || createPending || !name.trim() || !value.trim()}
        >
          add credential
        </button>
      </div>
      <div className="mt-4 overflow-hidden rounded border border-border bg-surface-1">
        {credentials.length === 0 ? (
          <div className="px-3 py-3 text-fg-faint">No upstream credentials stored.</div>
        ) : (
          <div className="divide-y divide-border">
            <div className="grid grid-cols-[minmax(120px,0.8fr)_minmax(140px,0.8fr)_minmax(420px,1.9fr)_minmax(160px,0.8fr)_40px] items-center gap-x-4 bg-surface-0 px-3 py-2 text-[10px] uppercase tracking-[0.12em] text-fg-faint max-lg:hidden">
              <span>Name</span>
              <span>Slug</span>
              <span>Placeholder</span>
              <span>Last used</span>
              <span className="text-center">Action</span>
            </div>
            {credentials.map((credential) => (
              <div
                key={credential.id}
                className="grid gap-2 px-3 py-2.5 lg:grid-cols-[minmax(120px,0.8fr)_minmax(140px,0.8fr)_minmax(420px,1.9fr)_minmax(160px,0.8fr)_40px] lg:items-center lg:gap-x-4"
              >
                <div className="min-w-0">
                  <div className="text-[10px] uppercase tracking-[0.12em] text-fg-faint lg:hidden">Name</div>
                  <div className="truncate text-fg">{credential.name}</div>
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] uppercase tracking-[0.12em] text-fg-faint lg:hidden">Slug</div>
                  <div className="truncate text-fg-dim">{credential.slug}</div>
                </div>
                <div className="min-w-0">
                  <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-fg-faint lg:hidden">
                    Placeholder
                  </div>
                  <CopyableCode text={`{{llama-dash:credential:${credential.slug}}}`} />
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] uppercase tracking-[0.12em] text-fg-faint lg:hidden">Last used</div>
                  <div className="truncate text-fg-faint">{credential.lastUsedAt ?? 'never'}</div>
                </div>
                <Tooltip label="Delete Credential" side="top">
                  <button
                    type="button"
                    className="inline-flex size-8 items-center justify-center justify-self-start rounded text-fg-faint transition-colors hover:bg-surface-3 hover:text-err focus-visible:outline-none focus-visible:shadow-focus disabled:cursor-not-allowed disabled:opacity-40 lg:justify-self-center"
                    onClick={() => onDelete(credential.id)}
                    disabled={deletePending}
                    aria-label={`Delete credential ${credential.name}`}
                  >
                    <Trash2 className="size-3.5" strokeWidth={2} aria-hidden="true" />
                  </button>
                </Tooltip>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
