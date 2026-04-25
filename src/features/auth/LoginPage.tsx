import { useNavigate, useSearch } from '@tanstack/react-router'
import { LockKeyhole } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { authClient } from '../../lib/auth-client'

type LoginSearch = { redirect?: string }

export function LoginPage() {
  const navigate = useNavigate()
  const search = useSearch({ strict: false }) as LoginSearch
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setPending(true)
    const result = await authClient.signIn.username({ username, password })
    setPending(false)

    if (result.error) {
      setError(result.error.message || 'Invalid username or password')
      return
    }

    await navigate({ to: safeRedirect(search.redirect) })
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-surface-0 px-4 text-fg">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm overflow-hidden rounded border border-border bg-surface-1 shadow-[0_24px_80px_rgba(0,0,0,0.28)]"
      >
        <div className="border-b border-border bg-surface-2 px-5 py-4">
          <div className="mb-3 inline-flex size-9 items-center justify-center rounded border border-border bg-surface-1 text-accent">
            <LockKeyhole className="size-4" strokeWidth={1.75} aria-hidden="true" />
          </div>
          <h1 className="m-0 text-xl font-semibold tracking-[-0.015em]">Sign in to llama-dash</h1>
          <p className="mt-1 font-mono text-xs leading-relaxed text-fg-dim">
            Dashboard and admin API access require a local session.
          </p>
        </div>

        <div className="flex flex-col gap-4 px-5 py-5">
          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-fg-faint">
              username
            </span>
            <input
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.currentTarget.value)}
              className="rounded border border-border bg-surface-2 px-3 py-2 font-mono text-sm text-fg outline-none transition-colors focus:border-accent"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-fg-faint">
              password
            </span>
            <input
              autoComplete="current-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.currentTarget.value)}
              className="rounded border border-border bg-surface-2 px-3 py-2 font-mono text-sm text-fg outline-none transition-colors focus:border-accent"
            />
          </label>

          {error ? (
            <div className="rounded border border-err/40 bg-err-bg px-3 py-2 text-xs text-err">{error}</div>
          ) : null}

          <button type="submit" className="btn btn-primary btn-md justify-center" disabled={pending}>
            {pending ? 'Signing in...' : 'Sign in'}
          </button>
        </div>
      </form>
    </main>
  )
}

function safeRedirect(value: string | undefined): string {
  if (!value?.startsWith('/') || value.startsWith('//') || value.startsWith('/api/')) return '/'
  return value
}
