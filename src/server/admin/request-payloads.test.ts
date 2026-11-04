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
import { requestRoutes } from './routes/requests'
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

it('maps metadata routing and timing fields alongside payloads that prefer recent bodies', () => {
  row({
    id: 'req_test',
    startedAt: new Date(),
    keyId: null,
    requestBody: 'truncated',
    responseBody: null,
    requestHeaders: '{}',
    responseHeaders: null,
    routingRequestedModel: 'original',
    routingRejectReason: null,
    routingRuleId: null,
    streamCloseMs: 5,
  })
  storeRecentBodies('req_test', { requestBody: 'full request', responseBody: 'full response' })
  const metadata = getRequestMetadataById('req_test')
  const payloads = getRequestPayloadsById('req_test')
  expect(mocks.select).toHaveBeenCalledTimes(2)
  expect(metadata).toMatchObject({ id: 'req_test', routingRequestedModel: 'original', streamCloseMs: 5 })
  expect(payloads).toEqual({
    requestHeaders: '{}',
    requestBody: 'full request',
    responseHeaders: null,
    responseBody: 'full response',
  })
})

it('routes metadata and payloads but no longer serves combined request detail', () => {
  const matching = (path: string) =>
    requestRoutes.filter((r) => r.method === 'GET' && r.pattern.test(path)).map((r) => r.pattern.source)
  expect(matching('/api/requests/req_test/metadata')).toHaveLength(1)
  expect(matching('/api/requests/req_test/metadata')[0]).toContain('metadata')
  expect(matching('/api/requests/req_test/payloads')).toHaveLength(1)
  expect(matching('/api/requests/req_test/payloads')[0]).toContain('payloads')
  expect(matching('/api/requests/stats')).toHaveLength(1)
  expect(matching('/api/requests/histogram')).toHaveLength(1)
  expect(matching('/api/requests/req_test')).toEqual([])
})
