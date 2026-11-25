import { drizzle } from 'drizzle-orm/better-sqlite3'
import { expect, it, vi } from 'vitest'
import {
  ALL_SET_FILTER,
  applyRequestFilters,
  REQUEST_HOST_FILTER_NONE,
  REQUEST_KEY_FILTER_NONE,
  REQUEST_KEY_FILTER_PROXY,
  requestKeyNameFilterValue,
  type SetFilter,
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
    const { listRecentRequests, requestFilterOptions, requestFilterCounts, countMatchingRequests } = await import(
      './requests'
    )
    const { requestRoutes } = await import('./routes/requests')
    const all = listRecentRequests({ limit: 500, includeMcp: true })
    expect(requestFilterOptions()).toEqual({
      models: ['other', 'target'],
      hosts: ['host-a'],
      keys: ['voice'],
      systemKeys: [],
    })
    const inc = (...values: string[]): SetFilter => ({ mode: 'include', values })
    const exc = (...values: string[]): SetFilter => ({ mode: 'exclude', values })
    const defaults = {
      statusFilter: 'all' as const,
      modelFilter: ALL_SET_FILTER,
      keyFilter: ALL_SET_FILTER,
      routingFilter: ALL_SET_FILTER,
      clientFilter: '',
      hostFilter: ALL_SET_FILTER,
      endUserFilter: '',
      sessionFilter: '',
      search: '',
    }
    const cases = [
      {
        filters: {
          modelFilter: inc('target'),
          keyFilter: inc(requestKeyNameFilterValue('voice')),
          clientFilter: 'éxample%_',
          hostFilter: inc('host-a'),
          endUserFilter: 'ALICE',
          sessionFilter: 'SESS',
        },
        sql: {
          models: inc('target'),
          keys: inc(requestKeyNameFilterValue('voice')),
          client: 'éxample%_',
          hosts: inc('host-a'),
          endUser: 'ALICE',
          session: 'SESS',
        },
      },
      {
        filters: { keyFilter: inc(REQUEST_KEY_FILTER_PROXY), hostFilter: inc(REQUEST_HOST_FILTER_NONE) },
        sql: { keys: inc(REQUEST_KEY_FILTER_PROXY), hosts: inc(REQUEST_HOST_FILTER_NONE) },
      },
      { filters: { keyFilter: inc(REQUEST_KEY_FILTER_NONE) }, sql: { keys: inc(REQUEST_KEY_FILTER_NONE) } },
      { filters: { search: 'ÉXAMPLE%_' }, sql: { search: 'ÉXAMPLE%_' } },
      { filters: { search: '404' }, sql: { search: '404' } },
      { filters: { search: 'POST' }, sql: { search: 'POST' } },
      {
        filters: {
          modelFilter: inc('target', 'other'),
          keyFilter: inc(REQUEST_KEY_FILTER_NONE, REQUEST_KEY_FILTER_PROXY),
        },
        sql: { models: inc('target', 'other'), keys: inc(REQUEST_KEY_FILTER_NONE, REQUEST_KEY_FILTER_PROXY) },
      },
      {
        filters: { hostFilter: inc(REQUEST_HOST_FILTER_NONE, 'host-a') },
        sql: { hosts: inc(REQUEST_HOST_FILTER_NONE, 'host-a') },
      },
      {
        filters: { routingFilter: inc('unrouted'), statusFilter: 'ok' as const },
        sql: { routing: inc('unrouted'), status: 'ok' as const },
      },
      {
        filters: { routingFilter: inc('routed'), statusFilter: 'err' as const },
        sql: { routing: inc('routed'), status: 'err' as const },
      },
      // Exclusions keep rows whose column is NULL (no model / no host) unless that bucket is excluded.
      { filters: { modelFilter: exc('target') }, sql: { models: exc('target') } },
      { filters: { hostFilter: exc('host-a') }, sql: { hosts: exc('host-a') } },
      { filters: { hostFilter: exc(REQUEST_HOST_FILTER_NONE) }, sql: { hosts: exc(REQUEST_HOST_FILTER_NONE) } },
      {
        filters: { keyFilter: exc(requestKeyNameFilterValue('voice'), REQUEST_KEY_FILTER_PROXY) },
        sql: { keys: exc(requestKeyNameFilterValue('voice'), REQUEST_KEY_FILTER_PROXY) },
      },
      { filters: { keyFilter: exc(REQUEST_KEY_FILTER_NONE) }, sql: { keys: exc(REQUEST_KEY_FILTER_NONE) } },
      { filters: { routingFilter: exc('routed') }, sql: { routing: exc('routed') } },
      // An empty inclusion selects nothing.
      { filters: { keyFilter: inc() }, sql: { keys: inc() } },
      { filters: { modelFilter: inc() }, sql: { models: inc() } },
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

    const ids = (rows: Array<{ id: string }>) => rows.map((r) => r.id)
    const excluded = await get('http://dash.test/api/requests?limit=500&includeMcp=true&key_not=key%3Avoice')
    expect(ids(excluded.requests)).toEqual(
      ids(applyRequestFilters(all, { ...defaults, keyFilter: exc(requestKeyNameFilterValue('voice')) })),
    )
    expect(excluded.requests.length).toBeGreaterThan(0)
    // A lone empty inclusion param means "nothing selected".
    expect((await get('http://dash.test/api/requests?includeMcp=true&key=')).requests).toEqual([])
    const both = await route.handler(
      new Request('http://dash.test/api/requests?key=key%3Avoice&key_not=key%3Avoice'),
      [] as unknown as RegExpMatchArray,
    )
    expect(both.status).toBe(400)
    const badRouting = await route.handler(
      new Request('http://dash.test/api/requests?routing_not=sideways'),
      [] as unknown as RegExpMatchArray,
    )
    expect(badRouting.status).toBe(400)

    const counts = requestFilterCounts({ includeMcp: true })
    const total = all.length
    const sum = (record: Record<string, number>) => Object.values(record).reduce((a, b) => a + b, 0)
    expect(sum(counts.keys)).toBe(total)
    expect(sum(counts.hosts)).toBe(total)
    expect(sum(counts.routing)).toBe(total)
    expect(counts.keys[requestKeyNameFilterValue('voice')]).toBe(
      applyRequestFilters(all, { ...defaults, keyFilter: inc(requestKeyNameFilterValue('voice')) }).length,
    )
    expect(counts.keys[REQUEST_KEY_FILTER_PROXY]).toBe(1)
    expect(counts.hosts[REQUEST_HOST_FILTER_NONE]).toBe(
      applyRequestFilters(all, { ...defaults, hostFilter: inc(REQUEST_HOST_FILTER_NONE) }).length,
    )
    expect(counts.models.target).toBe(applyRequestFilters(all, { ...defaults, modelFilter: inc('target') }).length)
  } finally {
    vi.doUnmock('../db/index.ts')
    vi.doUnmock('./api-keys.ts')
    sqlite.close()
  }
})
