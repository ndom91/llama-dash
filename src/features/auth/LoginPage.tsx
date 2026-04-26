import { useNavigate, useSearch } from '@tanstack/react-router'
import { Eye } from 'lucide-react'
import { type SyntheticEvent, useState } from 'react'
import { authClient } from '../../lib/auth-client'

type LoginSearch = { redirect?: string }
type AuthMode = 'sign-in' | 'sign-up'

export function LoginPage() {
  const navigate = useNavigate()
  const search = useSearch({ strict: false }) as LoginSearch
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [remember, setRemember] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [mode, setMode] = useState<AuthMode>('sign-in')

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
    <main className="min-h-dvh bg-[#030504] text-[#d9ded9]">
      <section className="grid min-h-dvh border border-[#1d2421] bg-[#030504] lg:grid-cols-[28vw_minmax(0,1fr)]">
        <InstanceRail mode={mode} />
        <div className="flex min-w-0 flex-col px-[8vw] py-7 max-md:px-6">
          <div className="mb-auto flex items-start justify-between gap-4 font-mono text-[10px] uppercase tracking-[0.2em] text-[#59625f]">
            <span>
              auth / <span className="text-[#d9ded9]">{mode === 'sign-up' ? 'first run' : 'sign in'}</span>
            </span>
            {mode === 'sign-up' ? (
              <button
                type="button"
                onClick={() => {
                  setError(null)
                  setMode('sign-in')
                }}
                className="text-left lowercase tracking-normal text-[#69726d] hover:text-[#9fc48b]"
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
              setUsername={setUsername}
              setPassword={setPassword}
              setRemember={setRemember}
              onSignup={() => {
                setError(null)
                setMode('sign-up')
              }}
              onSubmit={(event) => onSubmit(event, 'sign-in')}
            />
          )}
          <div className="mt-auto flex items-center justify-between border-t border-[#1d2421] pt-4 font-mono text-[10px] text-[#5d6662]">
            <span>llama-dash · v0.4.2</span>
            <span>press ↵</span>
            <span>docs</span>
          </div>
        </div>
      </section>
    </main>
  )
}

function InstanceRail({ mode }: { mode: AuthMode }) {
  return (
    <aside className="flex flex-col border-r border-[#1d2421] bg-[#101417] px-[3vw] py-7">
      <div className="flex items-center justify-between font-mono">
        <div className="text-xl font-bold text-[#e2e7e2]">
          ld <span className="text-[#9fc48b]">_</span>
        </div>
        <div className="text-[10px] text-[#59625f]">v0.4.2</div>
      </div>

      <div className="mt-auto mb-[32vh]">
        <div className="mb-4 font-mono text-[10px] uppercase tracking-[0.32em] text-[#59625f]">
          - {mode === 'sign-up' ? 'first run' : 'this instance'}
        </div>
        <div className="font-mono text-2xl text-[#e2e7e2]">puff.lan</div>
        <div className="mt-3 flex items-center gap-2 font-mono text-[11px] text-[#98a19c]">
          <span className={`size-1.5 rounded-full ${mode === 'sign-up' ? 'bg-[#f3c982]' : 'bg-[#9fc48b]'}`} />
          <span className="size-1.5 rounded-full bg-[#89948f]" />
          <span>{mode === 'sign-up' ? 'awaiting first operator' : 'up · 22h 51m'}</span>
        </div>
      </div>

      <div className="mt-auto space-y-2 font-mono text-[11px] text-[#68716d]">
        <MetaLine label="commit" value="59843fb · main" />
        <MetaLine label="node" value="v24.15.0" />
        <MetaLine label="tls" value="disabled · plain http" highlight />
        <div className="flex gap-2 pt-5">
          {['#9fc48b', '#f3c982', '#e9a58c', '#c3a5df', '#92a8e8', '#a8d0d0', '#87918c'].map((color) => (
            <span key={color} className="size-2 rounded-full" style={{ backgroundColor: color }} />
          ))}
          <span className="ml-auto text-[#68716d]">self-hosted</span>
        </div>
      </div>
    </aside>
  )
}

function MetaLine({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between border-b border-dashed border-[#2a322f] pb-1">
      <span>{label}</span>
      <span className={highlight ? 'text-[#d4c176]' : 'text-[#d9ded9]'}>{value}</span>
    </div>
  )
}

function SignInForm({
  username,
  password,
  remember,
  pending,
  error,
  setUsername,
  setPassword,
  setRemember,
  onSignup,
  onSubmit,
}: {
  username: string
  password: string
  remember: boolean
  pending: boolean
  error: string | null
  setUsername: (value: string) => void
  setPassword: (value: string) => void
  setRemember: (value: boolean) => void
  onSignup: () => void
  onSubmit: (event: SyntheticEvent<HTMLFormElement>) => void
}) {
  return (
    <form onSubmit={onSubmit} className="mx-auto my-auto w-full max-w-[272px]">
      <h1 className="m-0 text-2xl font-semibold tracking-[-0.03em] text-[#d9ded9]">Sign in</h1>
      <p className="mt-1 font-mono text-xs text-[#59625f]">to continue to llama-dash · puff.lan</p>
      <Field label="username or email" value={username} onChange={setUsername} autoComplete="username" />
      <PasswordField label="password" value={password} onChange={setPassword} action="reset" />
      <label className="mt-4 flex items-center gap-2 font-mono text-[11px] text-[#88928d]">
        <input
          type="checkbox"
          checked={remember}
          onChange={(event) => setRemember(event.currentTarget.checked)}
          className="size-3 accent-[#76a866]"
        />
        remember this browser · 30 days
      </label>
      {error ? <ErrorBox error={error} /> : null}
      <SubmitButton pending={pending} label="Sign in" pendingLabel="Signing in..." />
      <button
        type="button"
        onClick={onSignup}
        className="mt-4 block font-mono text-[11px] text-[#69726d] hover:text-[#9fc48b]"
      >
        {'Signup ->'}
      </button>
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
    <form onSubmit={onSubmit} className="mx-auto my-auto w-full max-w-[272px]">
      <h1 className="m-0 text-2xl font-semibold tracking-[-0.03em] text-[#d9ded9]">Create operator</h1>
      <p className="mt-1 font-mono text-xs text-[#59625f]">first account on this instance · will be granted admin</p>
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
      <span className="mb-2 flex justify-between font-mono text-[10px] uppercase tracking-[0.16em] text-[#59625f]">
        {label}
        {optional ? <span className="lowercase tracking-normal">optional</span> : null}
      </span>
      <input
        autoComplete={autoComplete}
        type={type}
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
        className="h-10 w-full border border-[#1d2421] bg-[#101417] px-3 font-mono text-sm text-[#d9ded9] outline-none transition-colors focus:border-[#76a866]"
      />
    </label>
  )
}

function PasswordField({
  label,
  value,
  onChange,
  action,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  action?: string
}) {
  return (
    <label className="mt-5 block">
      <span className="mb-2 flex justify-between font-mono text-[10px] uppercase tracking-[0.16em] text-[#59625f]">
        {label}
        {action ? <span className="lowercase tracking-normal">{action}</span> : null}
      </span>
      <span className="relative block">
        <input
          autoComplete={label === 'confirm' ? 'new-password' : 'current-password'}
          type="password"
          value={value}
          onChange={(event) => onChange(event.currentTarget.value)}
          className="h-10 w-full border border-[#1d2421] bg-[#101417] px-3 pr-9 font-mono text-sm text-[#d9ded9] outline-none transition-colors focus:border-[#76a866]"
        />
        <Eye className="absolute top-1/2 right-3 size-3.5 -translate-y-1/2 text-[#59625f]" strokeWidth={1.75} />
      </span>
    </label>
  )
}

function PasswordStrength({ password }: { password: string }) {
  const filled = Math.min(4, Math.max(1, Math.floor(password.length / 4)))
  return (
    <div className="mt-3 flex items-center gap-2 font-mono text-[10px] text-[#59625f]">
      <div className="flex flex-1 gap-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <span key={i} className={`h-px flex-1 ${i < filled ? 'bg-[#9fc48b]' : 'bg-[#1d2421]'}`} />
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
      className="mt-5 h-10 w-full bg-[#76a866] font-mono text-sm font-bold text-[#030504] transition-colors hover:bg-[#88ba75] disabled:cursor-not-allowed disabled:opacity-60"
      disabled={pending}
    >
      {pending ? pendingLabel : `${label}  ->`}
    </button>
  )
}

function ErrorBox({ error }: { error: string }) {
  return <div className="mt-4 border border-[#7b3630] bg-[#231110] px-3 py-2 text-xs text-[#ef9388]">{error}</div>
}

function safeRedirect(value: string | undefined): string {
  if (!value?.startsWith('/') || value.startsWith('//') || value.startsWith('/api/')) return '/'
  return value
}
