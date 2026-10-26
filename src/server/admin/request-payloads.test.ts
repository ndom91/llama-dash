import { getTableColumns } from 'drizzle-orm'
import { afterEach, expect, it, vi } from 'vitest'
import { requests } from '../db/schema'

const mocks = vi.hoisted(() => ({ select: vi.fn() }))
vi.mock('../db/index.ts', async () => ({
  schema: await import('../db/schema'),
  db: { select: mocks.select },
  sqliteDb: {},
}))
vi.mock('./api-keys.ts', () => ({ getApiKeyName: () => null, getApiKeyNameMap: () => new Map() }))

import { getRequestMetadataById, getRequestPayloadsById } from './requests'
import { clearRecentBodiesForTest, storeRecentBodies } from '../proxy/recent-bodies'

afterEach(() => {
  vi.resetAllMocks()
  clearRecentBodiesForTest()
})

function row(value: unknown) {
  mocks.select.mockReturnValue({ from: () => ({ where: () => ({ get: () => value }) }) })
}

it('does not select payload or header columns for metadata', () => {
  row({ id: 'req_test', startedAt: new Date(), keyId: null })
  const metadata = getRequestMetadataById('req_test')
  const columns = mocks.select.mock.calls[0][0]
  expect(columns.id).toBe(getTableColumns(requests).id)
  for (const field of ['requestBody', 'responseBody', 'requestHeaders', 'responseHeaders']) {
    expect(columns).not.toHaveProperty(field)
    expect(metadata).not.toHaveProperty(field)
  }
})

it('loads payloads independently and retains recent full bodies', () => {
  row({ requestHeaders: null, requestBody: 'truncated', responseHeaders: null, responseBody: null })
  storeRecentBodies('req_test', { requestBody: 'full request', responseBody: 'full response' })
  expect(getRequestPayloadsById('req_test')).toEqual({
    requestHeaders: null,
    requestBody: 'full request',
    responseHeaders: null,
    responseBody: 'full response',
  })
  expect(Object.keys(mocks.select.mock.calls[0][0])).toHaveLength(4)
})

it('returns missing independently for deleted requests', () => {
  row(undefined)
  expect(getRequestMetadataById('req_deleted')).toBeNull()
  expect(getRequestPayloadsById('req_deleted')).toBeNull()
})
