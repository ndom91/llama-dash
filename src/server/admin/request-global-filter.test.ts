import { drizzle } from 'drizzle-orm/better-sqlite3'
import { expect, it, vi } from 'vitest'
import {
  applyRequestFilters,
  REQUEST_HOST_FILTER_NONE,
  REQUEST_KEY_FILTER_NONE,
  REQUEST_KEY_FILTER_PROXY,
  requestKeyNameFilterValue,
} from '../../lib/request-filters'
import * as schema from '../db/schema'
import { createMigratedTestDb, insertTestRequests } from '../db/test-db'

it('filters the full retained log with client-equivalent semantics and accurate pagination', async () => {
  const sqlite = createMigratedTestDb()
  const db = drizzle(sqlite, { schema })
  vi.doMock('../db/index.ts', () => ({ db, sqliteDb: sqlite, schema }))
  vi.doMock('./api-keys.ts', () => ({
    getApiKeyNameMap: () => new Map([['key_1', 'voice']]),
    getApiKeyName: () => null,
  }))
  insertTestRequests(sqlite, [
    ...Array.from({ length: 120 }, (_, i) => ({
      id: `req_z${String(i).padStart(3, '0')}`,
      startedAt: 1_800_000 + i,
      keyId: 'key_other',
      model: 'other',
    })),
    {
      id: 'req_a3',
      startedAt: 1_800_000,
      keyId: 'key_1',
      model: 'target',
      clientName: 'ÉXAMPLE%_client',
      clientHost: 'host-a',
      endUserId: 'Alice',
      sessionId: 'sess-1',
      statusCode: 500,
      routingActionType: 'rewrite_model',
    },
    {
      id: 'req_a2',
      startedAt: 1_800_001,
      keyId: 'key_1',
      model: 'target',
      clientName: 'Éxample%_client',
      clientHost: 'host-a',
      endUserId: 'Alice',
      sessionId: 'sess-1',
      statusCode: 200,
    },
    { id: 'req_a1', startedAt: 1_800_002, keyId: 'deleted_key', model: null, clientHost: null },
    { id: 'req_mcp2', startedAt: 1_800_003, requestClass: 'mcp_relay', model: 'target' },
    { id: 'req_mcp1', startedAt: 1_800_004, requestClass: 'mcp_relay', model: 'other' },
  ])
  sqlite.prepare("update requests set routing_auth_mode = 'passthrough' where id = 'req_a1'").run()
  try {
    const { listRecentRequests, requestFilterOptions, countMatchingRequests } = await import('./requests')
    const { requestRoutes } = await import('./routes/requests')
    const all = listRecentRequests({ limit: 500, includeMcp: true })
    expect(requestFilterOptions()).toEqual({ models: ['other', 'target'], hosts: ['host-a'], keys: ['voice'] })
    const defaults = {
      statusFilter: 'all' as const,
      modelFilter: [] as string[],
      keyFilter: [] as string[],
      routingFilter: 'all' as const,
      clientFilter: '',
      hostFilter: [] as string[],
      endUserFilter: '',
      sessionFilter: '',
      search: '',
    }
    const cases = [
      {
        filters: {
          modelFilter: ['target'],
          keyFilter: [requestKeyNameFilterValue('voice')],
          clientFilter: 'éxample%_',
          hostFilter: ['host-a'],
          endUserFilter: 'ALICE',
          sessionFilter: 'SESS',
        },
        sql: {
          models: ['target'],
          keys: [requestKeyNameFilterValue('voice')],
          client: 'éxample%_',
          hosts: ['host-a'],
          endUser: 'ALICE',
          session: 'SESS',
        },
      },
      {
        filters: { keyFilter: [REQUEST_KEY_FILTER_PROXY], hostFilter: [REQUEST_HOST_FILTER_NONE] },
        sql: { keys: [REQUEST_KEY_FILTER_PROXY], hosts: [REQUEST_HOST_FILTER_NONE] },
      },
      { filters: { keyFilter: [REQUEST_KEY_FILTER_NONE] }, sql: { keys: [REQUEST_KEY_FILTER_NONE] } },
      { filters: { search: 'ÉXAMPLE%_' }, sql: { search: 'ÉXAMPLE%_' } },
      { filters: { search: '404' }, sql: { search: '404' } },
      { filters: { search: 'POST' }, sql: { search: 'POST' } },
      {
        filters: { modelFilter: ['target', 'other'], keyFilter: [REQUEST_KEY_FILTER_NONE, REQUEST_KEY_FILTER_PROXY] },
        sql: { models: ['target', 'other'], keys: [REQUEST_KEY_FILTER_NONE, REQUEST_KEY_FILTER_PROXY] },
      },
      {
        filters: { hostFilter: [REQUEST_HOST_FILTER_NONE, 'host-a'] },
        sql: { hosts: [REQUEST_HOST_FILTER_NONE, 'host-a'] },
      },
      {
        filters: { routingFilter: 'unrouted' as const, statusFilter: 'ok' as const },
        sql: { routing: 'unrouted' as const, status: 'ok' as const },
      },
      {
        filters: { routingFilter: 'routed' as const, statusFilter: 'err' as const },
        sql: { routing: 'routed' as const, status: 'err' as const },
      },
    ]
    for (const { filters, sql } of cases) {
      expect(countMatchingRequests({ includeMcp: true, ...sql })).toBe(
        applyRequestFilters(all, { ...defaults, ...filters }).length,
      )
      expect(listRecentRequests({ limit: 500, includeMcp: true, ...sql }).map((r) => r.id)).toEqual(
        applyRequestFilters(all, { ...defaults, ...filters }).map((r) => r.id),
      )
    }
    const route = requestRoutes.find((entry) => entry.pattern.test('/api/requests'))!
    const get = async (url: string) => (await route.handler(new Request(url), [] as unknown as RegExpMatchArray)).json()
    expect((await get('http://dash.test/api/requests?model=target')).mcpHiddenCount).toBe(1)
    expect((await get('http://dash.test/api/requests?model=target&skipMcpCount=true')).mcpHiddenCount).toBeUndefined()
    const first = await get('http://dash.test/api/requests?limit=1&model=target&key=key%3Avoice')
    expect(first.requests.map((r: { id: string }) => r.id)).toEqual(['req_a3'])
    expect(first.nextCursor).toBe('req_a3')
    const second = await get(
      `http://dash.test/api/requests?limit=1&model=target&key=key%3Avoice&cursor=${first.nextCursor}`,
    )
    expect(second.requests.map((r: { id: string }) => r.id)).toEqual(['req_a2'])
    expect(second.nextCursor).toBeNull()
  } finally {
    vi.doUnmock('../db/index.ts')
    vi.doUnmock('./api-keys.ts')
    sqlite.close()
  }
})
