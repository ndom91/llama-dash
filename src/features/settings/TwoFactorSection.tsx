import { ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import QRCode from 'react-qr-code'
import { authClient } from '../../lib/auth-client'

type SetupState = {
  totpURI: string
  secret: string
  backupCodes: Array<string>
}

function extractSecret(totpURI: string): string {
  try {
    return new URL(totpURI).searchParams.get('secret') ?? ''
  } catch {
    return ''
  }
}

function BackupCodes({ codes }: { codes: Array<string> }) {
  return (
    <div className="rounded border border-border bg-surface-2 p-3">
      <div className="font-mono text-xs font-semibold text-fg">Backup codes</div>
      <div className="mt-1 font-mono text-[10px] text-fg-dim">
        Shown once — store them somewhere safe. Each code works once.
      </div>
      <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-xs text-fg sm:grid-cols-3">
        {codes.map((code) => (
          <span key={code}>{code}</span>
        ))}
      </div>
    </div>
  )
}

/** Two-factor enrollment and management for the dashboard account. Enable
 * requires the account password and ends with a TOTP verification; API keys
 * and the /v1/* proxy are unaffected. */
export function TwoFactorSection() {
  const session = authClient.useSession()
  const user = session.data?.user as { twoFactorEnabled?: boolean } | undefined
  const enabled = user?.twoFactorEnabled ?? false

  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [setup, setSetup] = useState<SetupState | null>(null)
  const [freshBackupCodes, setFreshBackupCodes] = useState<Array<string> | null>(null)

  function refreshSession() {
    void authClient.getSession({ query: { disableCookieCache: true } })
  }

  async function enable() {
    setError(null)
    setPending(true)
    const result = await authClient.twoFactor.enable({ password })
    setPending(false)
    if (result.error) {
      setError(result.error.message || 'Failed to enable two-factor')
      return
    }
    const totpURI = result.data?.totpURI ?? ''
    setSetup({ totpURI, secret: extractSecret(totpURI), backupCodes: result.data?.backupCodes ?? [] })
    setFreshBackupCodes(null)
    setPassword('')
    setCode('')
  }

  async function verify() {
    if (!setup) return
    setError(null)
    setPending(true)
    const result = await authClient.twoFactor.verifyTotp({ code: code.trim() })
    setPending(false)
    if (result.error) {
      setError(result.error.message || 'Invalid code')
      return
    }
    setSetup(null)
    setCode('')
    refreshSession()
  }

  async function disable() {
    setError(null)
    setPending(true)
    const result = await authClient.twoFactor.disable({ password })
    setPending(false)
    if (result.error) {
      setError(result.error.message || 'Failed to disable two-factor')
      return
    }
    setPassword('')
    setFreshBackupCodes(null)
    refreshSession()
  }

  async function regenerate() {
    setError(null)
    setPending(true)
    const result = await authClient.twoFactor.generateBackupCodes({ password })
    setPending(false)
    if (result.error) {
      setError(result.error.message || 'Failed to regenerate backup codes')
      return
    }
    setPassword('')
    setFreshBackupCodes(result.data?.backupCodes ?? [])
    refreshSession()
  }

  return (
    <div className="grid gap-5 border-t border-border pt-5 lg:grid-cols-[240px_minmax(0,1fr)]">
      <div>
        <div className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-fg-faint">
          <ShieldCheck className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
          Two-factor
        </div>
        <div className="font-mono text-lg font-semibold text-fg">Authenticator app</div>
        <div className="mt-1 font-mono text-xs leading-relaxed text-fg-dim">
          Require a TOTP code at dashboard sign-in, with single-use backup codes for recovery. API keys and client
          routes are unaffected.
        </div>
      </div>

      <div className="grid gap-3">
        {setup ? (
          <>
            <div className="rounded border border-border bg-surface-2 p-3">
              <div className="font-mono text-xs font-semibold text-fg">Scan with your authenticator</div>
              <div className="mt-3 flex items-start gap-4 max-sm:flex-col">
                <div className="rounded bg-white p-2">
                  <QRCode value={setup.totpURI} size={132} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-fg-faint">manual key</div>
                  <div className="mt-1 break-all font-mono text-xs text-fg">{setup.secret || '—'}</div>
                  <div className="mt-3 font-mono text-[10px] leading-relaxed text-fg-dim">
                    Enter the 6-digit code the app shows to activate two-factor.
                  </div>
                </div>
              </div>
            </div>

            <BackupCodes codes={setup.backupCodes} />

            <div className="rounded border border-border bg-surface-2 p-3">
              <label className="block font-mono text-xs font-semibold text-fg" htmlFor="two-factor-activate">
                Activate
              </label>
              <div className="mt-2 flex gap-2 max-sm:flex-col">
                <input
                  id="two-factor-activate"
                  value={code}
                  onChange={(event) => setCode(event.currentTarget.value)}
                  placeholder="123456"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={8}
                  className="h-9 min-w-0 flex-1 rounded border border-border bg-surface-3 px-3 font-mono text-xs text-fg outline-none transition-colors focus:border-accent"
                />
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={pending || code.trim().length === 0}
                  onClick={verify}
                >
                  {pending ? 'Verifying...' : 'Verify and enable'}
                </button>
              </div>
              {error ? <div className="mt-3 err-banner">{error}</div> : null}
            </div>
          </>
        ) : (
          <>
            <div className="rounded border border-border bg-surface-2 p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="font-mono text-xs font-semibold text-fg">
                  {enabled ? 'Two-factor is enabled' : 'Two-factor is off'}
                </div>
                <span className={`state-label ${enabled ? 'state-label-ok' : 'state-label-idle'}`}>
                  {enabled ? 'active' : 'inactive'}
                </span>
              </div>
              <div className="mt-1 font-mono text-[10px] text-fg-dim">
                {enabled
                  ? 'Sign-in requires a code from your authenticator app or a backup code.'
                  : 'Add a second factor to dashboard sign-in.'}
              </div>
            </div>

            {freshBackupCodes ? <BackupCodes codes={freshBackupCodes} /> : null}

            <div className="rounded border border-border bg-surface-2 p-3">
              <label className="block font-mono text-xs font-semibold text-fg" htmlFor="two-factor-password">
                Confirm password
              </label>
              <div className="mt-2 flex gap-2 max-sm:flex-col">
                <input
                  id="two-factor-password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.currentTarget.value)}
                  autoComplete="current-password"
                  className="h-9 min-w-0 flex-1 rounded border border-border bg-surface-3 px-3 font-mono text-xs text-fg outline-none transition-colors focus:border-accent"
                />
                {enabled ? (
                  <>
                    <button
                      type="button"
                      className="btn btn-sm"
                      disabled={pending || password.length === 0}
                      onClick={regenerate}
                    >
                      {pending ? 'Working...' : 'Regenerate backup codes'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      disabled={pending || password.length === 0}
                      onClick={disable}
                    >
                      Disable
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    disabled={pending || password.length === 0}
                    onClick={enable}
                  >
                    {pending ? 'Working...' : 'Enable two-factor'}
                  </button>
                )}
              </div>
              {error ? <div className="mt-3 err-banner">{error}</div> : null}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
