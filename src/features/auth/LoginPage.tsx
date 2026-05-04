import { useNavigate, useSearch } from '@tanstack/react-router'
import { Eye, Moon, Sun } from 'lucide-react'
import type * as React from 'react'
import { type SyntheticEvent, useEffect, useState } from 'react'
import { authClient } from '../../lib/auth-client'
import { cn } from '../../lib/cn'
import { useColorTheme } from '../../lib/use-color-theme'
import { useLoginMeta } from '../../lib/queries'

type LoginSearch = { redirect?: string }
type AuthMode = 'sign-in' | 'sign-up'

export function LoginPage() {
  const navigate = useNavigate()
  const search = useSearch({ strict: false }) as LoginSearch
  const { data: meta } = useLoginMeta()
  const [dashHost, setDashHost] = useState('local instance')
  const commit = meta?.commitLabel ?? 'unknown'
  const signupAllowed = meta?.signupAllowed ?? false
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [remember, setRemember] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [mode, setMode] = useState<AuthMode>('sign-in')

  useEffect(() => {
    setDashHost(window.location.host || window.location.hostname || 'local instance')
  }, [])

  useEffect(() => {
    if (typeof PublicKeyCredential === 'undefined' || !PublicKeyCredential.isConditionalMediationAvailable) return
    let cancelled = false
    PublicKeyCredential.isConditionalMediationAvailable()
      .then(async (available) => {
        if (!available || cancelled) return
        const result = await authClient.signIn.passkey({ autoFill: true })
        if (!cancelled && !result.error) await navigate({ to: safeRedirect(search.redirect) })
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [navigate, search.redirect])

  async function onSubmit(event: SyntheticEvent<HTMLFormElement>, submitMode: AuthMode) {
    event.preventDefault()
    setError(null)

    if (submitMode === 'sign-up' && password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setPending(true)
    const result =
      submitMode === 'sign-up'
        ? await authClient.signUp.email({ email, name: username, password, username, displayUsername: username })
        : username.includes('@')
          ? await authClient.signIn.email({ email: username, password, rememberMe: remember })
          : await authClient.signIn.username({ username, password, rememberMe: remember })
    setPending(false)

    if (result.error) {
      setError(result.error.message || 'Invalid username or password')
      return
    }

    await navigate({ to: safeRedirect(search.redirect) })
  }

  return (
    <main className="min-h-dvh bg-surface-0 text-fg">
      <section className="grid min-h-dvh grid-rows-[auto_minmax(0,1fr)] border border-border bg-surface-0 lg:grid-cols-[28vw_minmax(0,1fr)] lg:grid-rows-none">
        <InstanceRail mode={mode} dashHost={dashHost} />
        <div className="flex min-h-0 min-w-0 flex-col px-[8vw] py-7 max-md:px-6">
          <div className="mb-auto flex items-start justify-between gap-4 font-mono text-[10px] uppercase tracking-[0.2em] text-fg-dim">
            <span>
              auth / <span className="text-fg">{mode === 'sign-up' ? 'first run' : 'sign in'}</span>
            </span>
            {mode === 'sign-up' ? (
              <button
                type="button"
                onClick={() => {
                  setError(null)
                  setMode('sign-in')
                }}
                className="text-left lowercase tracking-normal text-fg-muted hover:text-accent"
              >
                {'have an account? sign in ->'}
              </button>
            ) : null}
          </div>
          {mode === 'sign-up' ? (
            <SignUpForm
              username={username}
              email={email}
              password={password}
              confirmPassword={confirmPassword}
              pending={pending}
              error={error}
              setUsername={setUsername}
              setEmail={setEmail}
              setPassword={setPassword}
              setConfirmPassword={setConfirmPassword}
              onSubmit={(event) => onSubmit(event, 'sign-up')}
            />
          ) : (
            <SignInForm
              username={username}
              password={password}
              remember={remember}
              pending={pending}
              error={error}
              signupAllowed={signupAllowed}
              setUsername={setUsername}
              setPassword={setPassword}
              setRemember={setRemember}
              onResetPassword={() => setPassword('')}
              onSignup={() => {
                setError(null)
                setMode('sign-up')
              }}
              onSubmit={(event) => onSubmit(event, 'sign-in')}
            />
          )}
          <div className="mt-auto flex items-center justify-between border-t border-border pt-4 font-mono text-[10px] text-fg-dim">
            <span>
              llama-dash ·{' '}
              <a
                href="https://github.com/ndom91/llama-dash"
                target="_blank"
                rel="noreferrer"
                className="text-accent transition-opacity hover:opacity-80"
              >
                {commit}
              </a>
            </span>
            <span>
              press <span className="text-accent">↵</span>
            </span>
            <span>
              clears <span className="text-accent">esc</span>
            </span>
          </div>
        </div>
      </section>
    </main>
  )
}

function InstanceRail({ mode, dashHost }: { mode: AuthMode; dashHost: string }) {
  const { data } = useLoginMeta()
  const colorTheme = useColorTheme()
  const [themeMode, setThemeMode] = useState<LoginThemeMode>('dark')
  const uptime = data?.uptimeLabel ?? 'checking runtime'
  const uptimeParts = splitUptimeLabel(uptime)
  const commit = data?.commitLabel ?? 'unknown'
  const tls = data?.tlsLabel ?? 'checking tls'

  useEffect(() => {
    setThemeMode(getInitialThemeMode())
  }, [])

  function toggleThemeMode() {
    const next = themeMode === 'dark' ? 'light' : 'dark'
    setThemeMode(next)
    applyThemeMode(next)
  }

  return (
    <aside className="flex flex-col border-r border-border bg-surface-1 px-[3vw] py-7 max-lg:border-r-0 max-lg:border-b max-lg:px-5 max-lg:py-4">
      <div className="flex items-center justify-between gap-4 font-mono">
        <div className="shrink-0 text-xl font-bold text-fg max-lg:text-lg">
          ld <span className="text-accent">_</span>
        </div>
        <div className="hidden min-w-0 flex-1 items-center justify-end gap-2 text-right font-mono max-lg:flex">
          <span className={cn('size-1.5 shrink-0 rounded-full', mode === 'sign-up' ? 'bg-warn' : 'bg-accent')} />
          <span className="truncate text-sm text-fg">{dashHost}</span>
          <span className="hidden text-[10px] text-fg-dim min-[420px]:inline">
            {mode === 'sign-up' ? (
              'first run'
            ) : (
              <>
                {uptimeParts.prefix}
                <span className="text-accent">{uptimeParts.value}</span>
              </>
            )}
          </span>
        </div>
      </div>

      <div className="mt-auto mb-[32vh] max-lg:hidden">
        <div className="mb-4 font-mono text-[10px] uppercase tracking-[0.32em] text-fg-dim">- llama-dash</div>
        <div className="break-all font-mono text-2xl text-fg">{dashHost}</div>
        <div className="mt-3 flex items-center gap-2 font-mono text-[11px] text-fg-muted">
          <span className={cn('size-1.5 rounded-full', mode === 'sign-up' ? 'bg-warn' : 'bg-accent')} />
          <span className="size-1.5 rounded-full bg-fg-dim" />
          <span>
            {mode === 'sign-up' ? (
              'awaiting first operator'
            ) : (
              <>
                {uptimeParts.prefix}
                <span className="text-accent">{uptimeParts.value}</span>
              </>
            )}
          </span>
        </div>
      </div>

      <div className="mt-auto space-y-2 font-mono text-[11px] text-fg-dim max-lg:hidden">
        <div className="max-lg:hidden">
          <MetaLine label="commit" value={commit} href="https://github.com/ndom91/llama-dash" />
          <MetaLine label="tls" value={tls} valueClassName={tls.includes('no tls') ? 'text-warn' : 'text-ok'} />
        </div>
        <div className="flex items-center gap-2 pt-5 max-lg:hidden">
          {colorTheme.themes.map((theme) => (
            <button
              key={theme.id}
              type="button"
              onClick={() => colorTheme.select(theme.id)}
              aria-label={`Use ${theme.name} accent theme`}
              aria-pressed={colorTheme.themeId === theme.id}
              className="group -m-2 inline-flex size-6.5 items-center justify-center rounded-full"
            >
              <span
                className={cn(
                  'size-2.5 rounded-full transition-all duration-500 ease-out group-hover:scale-140 group-hover:shadow-[0_0_6px_0.5px_var(--theme-glow)]',
                  colorTheme.themeId === theme.id &&
                    'scale-115 shadow-[0_0_0_1.5px_var(--color-surface-1),0_0_0_3px_var(--theme-ring)] group-hover:shadow-[0_0_0_1.5px_var(--color-surface-1),0_0_0_3px_var(--theme-ring),0_0_6px_0.5px_var(--theme-glow)]',
                )}
                style={
                  {
                    backgroundColor: theme.accent['500'],
                    '--theme-glow': `${theme.accent['500']}40`,
                    '--theme-ring': theme.accent['500'],
                  } as React.CSSProperties
                }
              />
            </button>
          ))}
          <button
            type="button"
            onClick={toggleThemeMode}
            aria-label={`Switch to ${themeMode === 'dark' ? 'light' : 'dark'} mode`}
            className="-my-2 ml-0 inline-flex size-7 items-center justify-center text-fg-dim transition-colors hover:text-fg"
          >
            {themeMode === 'dark' ? (
              <Sun className="size-3" strokeWidth={1.75} />
            ) : (
              <Moon className="size-3" strokeWidth={1.75} />
            )}
          </button>
          <span className="ml-auto text-fg-dim max-lg:hidden">self-hosted</span>
          <span className="ml-auto hidden text-fg-dim max-lg:inline">{tls}</span>
        </div>
      </div>
    </aside>
  )
}

type LoginThemeMode = 'light' | 'dark'

function splitUptimeLabel(label: string): { prefix: string; value: string } {
  const idx = label.lastIndexOf(' · ')
  if (idx === -1) return { prefix: '', value: label }
  return { prefix: label.slice(0, idx + 3), value: label.slice(idx + 3) }
}

function getInitialThemeMode(): LoginThemeMode {
  if (typeof window === 'undefined') return 'dark'
  const stored = window.localStorage.getItem('theme')
  if (stored === 'light' || stored === 'dark') return stored
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

function applyThemeMode(mode: LoginThemeMode) {
  document.documentElement.classList.remove('light', 'dark')
  document.documentElement.classList.add(mode)
  document.documentElement.setAttribute('data-theme', mode)
  document.documentElement.style.colorScheme = mode
  window.localStorage.setItem('theme', mode)
}

function MetaLine({
  label,
  value,
  href,
  valueClassName,
}: {
  label: string
  value: string
  href?: string
  valueClassName?: string
}) {
  const cls = valueClassName ?? 'text-accent'
  return (
    <div className="flex justify-between border-b border-dashed border-border pt-1">
      <span>{label}</span>
      {href ? (
        <a href={href} target="_blank" rel="noreferrer" className={cn(cls, 'transition-opacity hover:opacity-80')}>
          {value}
        </a>
      ) : (
        <span className={cls}>{value}</span>
      )}
    </div>
  )
}

function SignInForm({
  username,
  password,
  remember,
  pending,
  error,
  signupAllowed,
  setUsername,
  setPassword,
  setRemember,
  onResetPassword,
  onSignup,
  onSubmit,
}: {
  username: string
  password: string
  remember: boolean
  pending: boolean
  error: string | null
  signupAllowed: boolean
  setUsername: (value: string) => void
  setPassword: (value: string) => void
  setRemember: (value: boolean) => void
  onResetPassword: () => void
  onSignup: () => void
  onSubmit: (event: SyntheticEvent<HTMLFormElement>) => void
}) {
  return (
    <form onSubmit={onSubmit} className="mx-auto my-auto w-full max-w-[272px] max-lg:max-w-[320px]">
      <h1 className="m-0 text-2xl font-semibold tracking-[-0.03em] text-fg">Sign in</h1>
      <p className="mt-1 font-mono text-xs text-fg-dim">to continue to llama-dash</p>
      <Field label="username or email" value={username} onChange={setUsername} autoComplete="username webauthn" />
      <PasswordField
        label="password"
        value={password}
        onChange={setPassword}
        action="reset"
        onAction={onResetPassword}
      />
      <label className="mt-4 flex cursor-pointer items-center gap-2 font-mono text-[11px] text-fg-muted">
        <input
          type="checkbox"
          checked={remember}
          onChange={(event) => setRemember(event.currentTarget.checked)}
          className="size-3 cursor-pointer accent-accent"
        />
        remember this browser · 30 days
      </label>
      {error ? <ErrorBox error={error} /> : null}
      <SubmitButton pending={pending} label="Sign in" pendingLabel="Signing in..." />
      {signupAllowed ? (
        <button
          type="button"
          onClick={onSignup}
          className="mt-4 block font-mono text-[11px] text-fg-dim hover:text-accent"
        >
          {'Signup ->'}
        </button>
      ) : null}
    </form>
  )
}

function SignUpForm({
  username,
  email,
  password,
  confirmPassword,
  pending,
  error,
  setUsername,
  setEmail,
  setPassword,
  setConfirmPassword,
  onSubmit,
}: {
  username: string
  email: string
  password: string
  confirmPassword: string
  pending: boolean
  error: string | null
  setUsername: (value: string) => void
  setEmail: (value: string) => void
  setPassword: (value: string) => void
  setConfirmPassword: (value: string) => void
  onSubmit: (event: SyntheticEvent<HTMLFormElement>) => void
}) {
  return (
    <form onSubmit={onSubmit} className="mx-auto my-auto w-full max-w-[272px] max-lg:max-w-[320px]">
      <h1 className="m-0 text-2xl font-semibold tracking-[-0.03em] text-fg">Create operator</h1>
      <p className="mt-1 font-mono text-xs text-fg-dim">first account on this instance · will be granted admin</p>
      <Field label="username" value={username} onChange={setUsername} autoComplete="username" />
      <Field label="email" value={email} onChange={setEmail} autoComplete="email" type="email" />
      <PasswordField label="password" value={password} onChange={setPassword} />
      <PasswordStrength password={password} />
      <PasswordField label="confirm" value={confirmPassword} onChange={setConfirmPassword} />
      {error ? <ErrorBox error={error} /> : null}
      <SubmitButton pending={pending} label="Create operator" pendingLabel="Creating user..." />
    </form>
  )
}

function Field({
  label,
  value,
  onChange,
  autoComplete,
  optional,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (value: string) => void
  autoComplete: string
  optional?: boolean
  type?: string
}) {
  return (
    <label className="mt-5 block">
      <span className="mb-2 flex justify-between font-mono text-[10px] uppercase tracking-[0.16em] text-fg-dim">
        {label}
        {optional ? <span className="lowercase tracking-normal">optional</span> : null}
      </span>
      <input
        autoComplete={autoComplete}
        type={type}
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
        className="h-10 w-full rounded border border-border bg-surface-1 px-3 font-mono text-sm text-fg outline-none transition-[border-color,box-shadow] duration-100 focus:border-accent focus:shadow-focus"
      />
    </label>
  )
}

function PasswordField({
  label,
  value,
  onChange,
  action,
  onAction,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  action?: string
  onAction?: () => void
}) {
  const [visible, setVisible] = useState(false)
  const inputId = `password-${label.replace(/\s+/g, '-')}`

  return (
    <div className="mt-5 block">
      <div className="mb-2 flex justify-between font-mono text-[10px] uppercase tracking-[0.16em] text-fg-dim">
        <label htmlFor={inputId}>{label}</label>
        {action ? (
          <button
            type="button"
            onClick={onAction}
            className="lowercase tracking-normal transition-colors hover:text-accent"
          >
            {action}
          </button>
        ) : null}
      </div>
      <span className="relative block">
        <input
          id={inputId}
          autoComplete={label === 'confirm' ? 'new-password' : 'current-password'}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(event) => onChange(event.currentTarget.value)}
          className="h-10 w-full rounded border border-border bg-surface-1 px-3 pr-9 font-mono text-sm text-fg outline-none transition-[border-color,box-shadow] duration-100 focus:border-accent focus:shadow-focus"
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          className="absolute top-1/2 right-1 inline-flex size-8 -translate-y-1/2 items-center justify-center text-fg-dim transition-colors hover:text-accent"
        >
          <Eye className="size-3.5" strokeWidth={1.75} />
        </button>
      </span>
    </div>
  )
}

function PasswordStrength({ password }: { password: string }) {
  const filled = Math.min(4, Math.max(1, Math.floor(password.length / 4)))
  return (
    <div className="mt-3 flex items-center gap-2 font-mono text-[10px] text-fg-dim">
      <div className="flex flex-1 gap-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <span key={i} className={cn('h-px flex-1', i < filled ? 'bg-accent' : 'bg-border')} />
        ))}
      </div>
      <span>strong · {password.length} chars</span>
    </div>
  )
}

function SubmitButton({ pending, label, pendingLabel }: { pending: boolean; label: string; pendingLabel: string }) {
  return (
    <button
      type="submit"
      className="mt-5 h-10 w-full rounded bg-accent font-mono text-sm font-bold text-accent-on transition-[background-color,transform] hover:bg-accent-strong active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
      disabled={pending}
    >
      {pending ? pendingLabel : `${label}  ->`}
    </button>
  )
}

function ErrorBox({ error }: { error: string }) {
  return <div className="mt-4 rounded border border-err bg-err-bg px-3 py-2 text-xs text-err">{error}</div>
}

function safeRedirect(value: string | undefined): string {
  if (!value?.startsWith('/') || value.startsWith('//') || value.startsWith('/api/')) return '/'
  return value
}
