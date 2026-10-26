import { expect, it, vi } from 'vitest'
import { getScopedDashboardSession, withDashboardSessionScope } from './session-scope'

it('deduplicates the outer gate and SSR/server-function lookup within one request', async () => {
  const load = vi.fn(async () => null)
  await withDashboardSessionScope(async () => {
    await Promise.all([getScopedDashboardSession(load), getScopedDashboardSession(load)])
    await getScopedDashboardSession(load)
  })
  expect(load).toHaveBeenCalledOnce()
})

it('never shares a session promise between concurrent requests', async () => {
  const load = vi.fn(async () => null)
  await Promise.all(Array.from({ length: 3 }, () => withDashboardSessionScope(() => getScopedDashboardSession(load))))
  expect(load).toHaveBeenCalledTimes(3)
})

it('does not cache outside a request scope or suppress authentication errors', async () => {
  const load = vi.fn(async () => null)
  await getScopedDashboardSession(load)
  await getScopedDashboardSession(load)
  expect(load).toHaveBeenCalledTimes(2)
  await expect(
    withDashboardSessionScope(() =>
      getScopedDashboardSession(async () => {
        throw new Error('auth unavailable')
      }),
    ),
  ).rejects.toThrow('auth unavailable')
})
