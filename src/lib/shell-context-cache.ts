import type { getShellContext } from './auth-functions'

type ShellContext = Awaited<ReturnType<typeof getShellContext>>
const MAX_AGE_MS = 30_000
let cached: { value: ShellContext; at: number } | undefined

export function clearShellContext() {
  cached = undefined
}

// Browser-only UX cache. Every admin request still authenticates on the server.
export function rememberShellContext(value: ShellContext) {
  if (typeof window === 'undefined') return
  if (!value.session) {
    cached = undefined
  } else if (!cached || cached.value.session?.session.id !== value.session.session.id) {
    cached = { value, at: Date.now() }
  }
}

export function readShellContext(): ShellContext | undefined {
  if (typeof window === 'undefined' || !cached) return undefined
  if (
    Date.now() - cached.at >= MAX_AGE_MS ||
    new Date(cached.value.session!.session.expiresAt).getTime() <= Date.now()
  ) {
    cached = undefined
  }
  return cached?.value
}
