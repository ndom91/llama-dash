import { type SyntheticEvent, useState } from 'react'
import { authClient } from '../../lib/auth-client'

type Props = {
  onVerified: () => void
  onBack: () => void
}

/** Second step of sign-in when the account has two-factor enabled. Verifies a
 * TOTP code or a single-use backup code, with an opt-in trusted-device flag. */
export function TwoFactorForm({ onVerified, onBack }: Props) {
  const [code, setCode] = useState('')
  const [trustDevice, setTrustDevice] = useState(false)
  const [useBackupCode, setUseBackupCode] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setPending(true)
    const trimmed = code.trim()
    const result = useBackupCode
      ? await authClient.twoFactor.verifyBackupCode({ code: trimmed, trustDevice })
      : await authClient.twoFactor.verifyTotp({ code: trimmed, trustDevice })
    setPending(false)
    if (result.error) {
      setError(result.error.message || 'Invalid code')
      return
    }
    onVerified()
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto my-auto w-full max-w-68 max-lg:max-w-80">
      <h1 className="m-0 text-2xl font-semibold tracking-[-0.03em] text-fg">Two-factor</h1>
      <p className="mt-1 font-mono text-xs text-fg-dim">
        {useBackupCode ? 'enter one of your single-use backup codes' : 'enter the code from your authenticator app'}
      </p>
      <label className="mt-5 block">
        <span className="mb-2 flex justify-between font-mono text-[10px] uppercase tracking-[0.16em] text-fg-dim">
          {useBackupCode ? 'backup code' : 'authentication code'}
        </span>
        <input
          value={code}
          onChange={(event) => setCode(event.currentTarget.value)}
          inputMode={useBackupCode ? 'text' : 'numeric'}
          autoComplete="one-time-code"
          maxLength={useBackupCode ? 32 : 8}
          className="h-10 w-full rounded border border-border bg-surface-1 px-3 font-mono text-sm text-fg outline-none transition-[border-color,box-shadow] duration-100 focus:border-accent focus:shadow-focus"
        />
      </label>
      <label className="mt-4 flex cursor-pointer items-center gap-2 font-mono text-[11px] text-fg-muted">
        <input
          type="checkbox"
          checked={trustDevice}
          onChange={(event) => setTrustDevice(event.currentTarget.checked)}
          className="size-3 cursor-pointer accent-accent"
        />
        trust this device · 30 days
      </label>
      {error ? (
        <div className="mt-4 rounded border border-err bg-err-bg px-3 py-2 text-xs text-err">{error}</div>
      ) : null}
      <button
        type="submit"
        className="mt-5 h-10 w-full rounded bg-accent font-mono text-sm font-bold text-accent-on transition-[background-color,transform] hover:bg-accent-strong active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-60"
        disabled={pending || code.trim().length === 0}
      >
        {pending ? 'Verifying...' : 'Verify'}
      </button>
      <div className="mt-4 flex items-center justify-between font-mono text-[11px] text-fg-dim">
        <button
          type="button"
          className="transition-colors hover:text-accent"
          onClick={() => {
            setError(null)
            setUseBackupCode((current) => !current)
          }}
        >
          {useBackupCode ? 'use authenticator code' : 'use a backup code'}
        </button>
        <button
          type="button"
          className="transition-colors hover:text-accent"
          onClick={() => {
            setError(null)
            onBack()
          }}
        >
          back to sign in
        </button>
      </div>
    </form>
  )
}
