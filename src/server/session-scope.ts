import { AsyncLocalStorage } from 'node:async_hooks'
import type { auth } from './auth'

type Session = Awaited<ReturnType<typeof auth.api.getSession>>
const scope = new AsyncLocalStorage<{ session?: Promise<Session> }>()

export function withDashboardSessionScope<T>(handler: () => T): T {
  return scope.run({}, handler)
}

export function getScopedDashboardSession(load: () => Promise<Session>): Promise<Session> {
  const current = scope.getStore()
  if (!current) return load()
  current.session ??= load()
  return current.session
}
