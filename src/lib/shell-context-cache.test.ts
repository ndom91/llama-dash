// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { readShellContext, rememberShellContext } from './shell-context-cache'
import { getRequestTheme } from './theme-server'

type Shell = Parameters<typeof rememberShellContext>[0]
const signedOut: Shell = {
  session: null,
  theme: getRequestTheme(new Headers()),
  sidebarCollapsed: false,
  inference: null,
}

afterEach(() => {
  rememberShellContext(signedOut)
  vi.useRealTimers()
})

it('does not cache signed-out contexts', () => {
  rememberShellContext(signedOut)
  expect(readShellContext()).toBeUndefined()
})

it('does not extend shell freshness on repeated navigation', () => {
  vi.useFakeTimers()
  const shell = {
    ...signedOut,
    session: { session: { id: 'session-test', expiresAt: new Date(Date.now() + 60_000) } },
  } as Shell
  rememberShellContext(shell)
  expect(readShellContext()).toBe(shell)
  vi.advanceTimersByTime(20_000)
  rememberShellContext(shell)
  vi.advanceTimersByTime(10_000)
  expect(readShellContext()).toBeUndefined()
})

it('never reuses an expired session', () => {
  vi.useFakeTimers()
  rememberShellContext({
    ...signedOut,
    session: { session: { id: 'session-expiring', expiresAt: new Date(Date.now() + 500) } },
  } as Shell)
  vi.advanceTimersByTime(501)
  expect(readShellContext()).toBeUndefined()
})
