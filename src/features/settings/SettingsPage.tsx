import { KeyRound, Monitor, ShieldCheck, Trash2 } from 'lucide-react'
import { PageHeader } from '../../components/PageHeader'
import { ThemeToggle } from '../../components/ThemeToggle'
import { TopBar } from '../../components/TopBar'
import { authClient } from '../../lib/auth-client'
import { cn } from '../../lib/cn'
import { usePrivacySettings, useUpdatePrivacySettings } from '../../lib/queries'
import { useColorTheme } from '../../lib/use-color-theme'
import { useState } from 'react'

function SettingsPanel({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section className="panel !rounded-none !border-x-0 border-t-1 first:border-t-0 !bg-surface-1">
      <div className="panel-head bg-transparent px-6 max-md:px-4">
        <span className="panel-title">{title}</span>
        <span className="panel-sub">· {subtitle}</span>
      </div>
      <div className="px-6 py-5 max-md:px-4">{children}</div>
    </section>
  )
}

function PrivacyToggle({
  title,
  description,
  enabled,
  disabled,
  onToggle,
}: {
  title: string
  description: string
  enabled: boolean
  disabled?: boolean
  onToggle: () => void
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded border border-border bg-surface-2 p-3">
      <div>
        <div className="font-mono text-xs font-semibold text-fg">{title}</div>
        <div className="mt-1 font-mono text-[11px] leading-relaxed text-fg-dim">{description}</div>
      </div>
      <button
        type="button"
        onClick={onToggle}
        disabled={disabled}
        aria-label={`${enabled ? 'Disable' : 'Enable'} ${title.toLowerCase()}`}
        className={cn(
          'relative inline-flex h-5 w-8 shrink-0 items-center rounded-full border transition-colors disabled:cursor-not-allowed disabled:opacity-50',
          enabled ? 'border-accent bg-accent/30' : 'border-border bg-surface-3',
        )}
        aria-pressed={enabled}
      >
        <span
          className={cn(
            'inline-block h-3.5 w-3.5 rounded-full bg-fg transition-transform',
            enabled ? 'translate-x-[14px]' : 'translate-x-[2px]',
          )}
        />
      </button>
    </div>
  )
}

export function SettingsPage() {
  const colorTheme = useColorTheme()
  const privacySettings = usePrivacySettings()
  const updatePrivacySettings = useUpdatePrivacySettings()
  const passkeys = authClient.useListPasskeys()
  const [passkeyName, setPasskeyName] = useState('')
  const [passkeyPending, setPasskeyPending] = useState(false)
  const [passkeyError, setPasskeyError] = useState<string | null>(null)
  const activeTheme = colorTheme.themes.find((theme) => theme.id === colorTheme.themeId) ?? colorTheme.themes[0]
  const privacy = privacySettings.data
  const isPrivacyMutating = updatePrivacySettings.isPending

  async function addPasskey() {
    setPasskeyError(null)
    setPasskeyPending(true)
    const result = await authClient.passkey.addPasskey({ name: passkeyName.trim() || undefined })
    setPasskeyPending(false)
    if (result.error) {
      setPasskeyError(result.error.message || 'Failed to add passkey')
      return
    }
    setPasskeyName('')
  }

  async function deletePasskey(id: string) {
    setPasskeyError(null)
    const result = await authClient.$fetch('/passkey/delete-passkey', { method: 'POST', body: { id } })
    if (result.error) setPasskeyError(result.error.message || 'Failed to delete passkey')
  }

  return (
    <div className="main-col">
      <TopBar />
      <div className="content">
        <div className="page min-h-full px-0">
          <PageHeader
            kicker="cfg · settings"
            title="Settings"
            subtitle="application preferences and global proxy defaults"
            variant="integrated"
          />

          <div className="flex min-h-0 flex-1 flex-col">
            <SettingsPanel title="Appearance" subtitle="theme and display mode">
              <div className="grid gap-5 lg:grid-cols-[240px_minmax(0,1fr)]">
                <div className="flex flex-col flex-1 items-stretch">
                  <div className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-fg-faint">
                    <Monitor className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
                    Active theme
                  </div>
                  <div className="font-mono text-lg font-semibold text-accent">{activeTheme.name}</div>
                  <div className="mt-1 font-mono text-xs text-fg-dim">Accent and semantic status colors.</div>
                  <div className="mt-4 space-y-2 flex-1 flex flex-col justify-end">
                    <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-fg-faint">mode</div>
                    <ThemeToggle variant="segmented" />
                  </div>
                </div>

                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                  {colorTheme.themes.map((theme) => {
                    const selected = theme.id === colorTheme.themeId
                    return (
                      <button
                        key={theme.id}
                        type="button"
                        className={cn(
                          'group min-h-20 cursor-pointer rounded border border-border bg-surface-2 p-3 text-left transition-[border-color,background-color,box-shadow] duration-150 hover:border-border-strong hover:bg-surface-3',
                          selected && 'border-accent shadow-[inset_2px_0_0_var(--accent)]',
                        )}
                        onClick={() => colorTheme.select(theme.id)}
                      >
                        <div className="mb-3 flex items-center gap-1.5">
                          {(['300', '500', '700'] as const).map((step) => (
                            <span
                              key={step}
                              className="size-3 rounded-pill border border-border"
                              style={{ background: theme.accent[step] }}
                            />
                          ))}
                        </div>
                        <div className="font-mono text-xs font-semibold text-fg">{theme.name}</div>
                        <div className="mt-1 font-mono text-[10px] text-fg-faint">
                          {selected ? 'selected' : 'available'}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            </SettingsPanel>

            <SettingsPanel title="Security" subtitle="dashboard passkeys">
              <div className="grid gap-5 lg:grid-cols-[240px_minmax(0,1fr)]">
                <div>
                  <div className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-fg-faint">
                    <KeyRound className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
                    Passkeys
                  </div>
                  <div className="font-mono text-lg font-semibold text-fg">Passwordless sign-in</div>
                  <div className="mt-1 font-mono text-xs leading-relaxed text-fg-dim">
                    Register a passkey after signing in, then use biometrics, a device PIN, or a hardware key on the
                    login page.
                  </div>
                </div>

                <div className="grid gap-3">
                  <div className="rounded border border-border bg-surface-2 p-3">
                    <label className="block font-mono text-xs font-semibold text-fg" htmlFor="passkey-name">
                      New passkey
                    </label>
                    <div className="mt-2 flex gap-2 max-sm:flex-col">
                      <input
                        id="passkey-name"
                        value={passkeyName}
                        onChange={(event) => setPasskeyName(event.currentTarget.value)}
                        placeholder="This device"
                        className="h-9 min-w-0 flex-1 rounded border border-border bg-surface-3 px-3 font-mono text-xs text-fg outline-none transition-colors focus:border-accent"
                      />
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        disabled={passkeyPending}
                        onClick={addPasskey}
                      >
                        {passkeyPending ? 'Waiting...' : 'Add passkey'}
                      </button>
                    </div>
                    {passkeyError ? <div className="mt-3 err-banner">{passkeyError}</div> : null}
                  </div>

                  <div className="grid gap-2">
                    {(passkeys.data ?? []).length === 0 ? (
                      <div className="rounded border border-dashed border-border bg-surface-2 p-3 font-mono text-xs text-fg-dim">
                        No passkeys registered.
                      </div>
                    ) : (
                      (passkeys.data ?? []).map((passkey) => (
                        <div
                          key={passkey.id}
                          className="flex items-center gap-3 rounded border border-border bg-surface-2 p-3"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-mono text-xs font-semibold text-fg">
                              {passkey.name || 'Unnamed passkey'}
                            </div>
                            <div className="mt-1 font-mono text-[10px] text-fg-dim">
                              {passkey.deviceType} · {passkey.backedUp ? 'synced' : 'device-bound'}
                            </div>
                          </div>
                          <button
                            type="button"
                            className="btn btn-ghost btn-icon"
                            onClick={() => deletePasskey(passkey.id)}
                            aria-label={`Delete ${passkey.name || 'passkey'}`}
                          >
                            <Trash2 className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </SettingsPanel>

            <SettingsPanel title="Logging & Privacy" subtitle="global proxy capture policy">
              <div className="grid gap-5 lg:grid-cols-[240px_minmax(0,1fr)]">
                <div>
                  <div className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-fg-faint">
                    <ShieldCheck className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
                    Capture policy
                  </div>
                  <div className="font-mono text-lg font-semibold text-fg">Request logs</div>
                  <div className="mt-1 font-mono text-xs leading-relaxed text-fg-dim">
                    Controls what prompt and response payloads are retained after proxy requests complete.
                  </div>
                </div>

                <div className="grid gap-3 xl:grid-cols-2">
                  <PrivacyToggle
                    title="Request bodies"
                    description="Store forwarded request payloads for request detail inspection. Disable to avoid retaining prompts."
                    enabled={privacy?.captureRequestBodies ?? false}
                    disabled={!privacy || isPrivacyMutating}
                    onToggle={() =>
                      privacy && updatePrivacySettings.mutate({ captureRequestBodies: !privacy.captureRequestBodies })
                    }
                  />
                  <PrivacyToggle
                    title="Response bodies"
                    description="Store upstream response payloads for debugging. Token usage scanning continues even when disabled."
                    enabled={privacy?.captureResponseBodies ?? false}
                    disabled={!privacy || isPrivacyMutating}
                    onToggle={() =>
                      privacy && updatePrivacySettings.mutate({ captureResponseBodies: !privacy.captureResponseBodies })
                    }
                  />
                  <label className="flex flex-col gap-2 rounded border border-border bg-surface-2 p-3 xl:col-span-2">
                    <span className="font-mono text-xs font-semibold text-fg">Max stored body bytes</span>
                    <span className="font-mono text-[11px] leading-relaxed text-fg-dim">
                      Truncates persisted request and response bodies. Set to 0 to store no body text.
                    </span>
                    <input
                      type="number"
                      min={0}
                      max={1024 * 1024}
                      step={1024}
                      disabled={!privacy || isPrivacyMutating}
                      className="h-9 max-w-48 rounded border border-border bg-surface-3 px-3 font-mono text-xs text-fg disabled:cursor-not-allowed disabled:opacity-50"
                      value={privacy?.maxStoredBodyBytes ?? ''}
                      onChange={(event) => {
                        const value = Number(event.target.value)
                        if (!Number.isFinite(value) || value < 0) return
                        updatePrivacySettings.mutate({ maxStoredBodyBytes: value })
                      }}
                    />
                  </label>
                </div>
              </div>
            </SettingsPanel>
          </div>
        </div>
      </div>
    </div>
  )
}
