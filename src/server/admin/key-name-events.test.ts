import { expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ update: vi.fn(() => true), remove: vi.fn(() => true), publish: vi.fn() }))
vi.mock('./api-keys.ts', () => ({
  createApiKey: vi.fn(),
  deleteApiKey: mocks.remove,
  getApiKeyById: vi.fn(),
  getSystemKeyRaw: vi.fn(),
  listApiKeys: vi.fn(),
  revokeApiKey: vi.fn(),
  rotateApiKey: vi.fn(),
  updateApiKey: mocks.update,
}))
vi.mock('./key-detail.ts', () => ({ getKeyModelBreakdown: vi.fn(), getKeyRequests: vi.fn(), getKeyStats: vi.fn() }))
vi.mock('./events.ts', () => ({ publishAdminEvent: mocks.publish }))

import { keyRoutes } from './routes/keys'

it('publishes key name changes and deletions but not unrelated edits', async () => {
  const patch = keyRoutes.find((route) => route.method === 'PATCH')!
  const remove = keyRoutes.find((route) => route.method === 'DELETE')!
  const match = ['/api/keys/key_1', 'key_1'] as unknown as RegExpMatchArray
  const update = (body: object) =>
    patch.handler(
      new Request('http://dash.test/api/keys/key_1', { method: 'PATCH', body: JSON.stringify(body) }),
      match,
    )
  expect((await update({ name: 'new name' })).status).toBe(200)
  expect((await update({ systemPrompt: 'test' })).status).toBe(200)
  expect(
    (await remove.handler(new Request('http://dash.test/api/keys/key_1', { method: 'DELETE' }), match)).status,
  ).toBe(200)
  expect(mocks.publish.mock.calls).toEqual([['key.names.changed'], ['key.names.changed']])
})
