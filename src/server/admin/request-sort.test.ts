import { drizzle } from 'drizzle-orm/better-sqlite3'
import { expect, it, vi } from 'vitest'
import { compareRequests, requestCursor, type SortDir, type SortKey } from '../../lib/request-sort'
import * as schema from '../db/schema'
import { createMigratedTestDb, insertTestRequests } from '../db/test-db'

it('paginates every global sort through ties, null tokens, pruning and live arrivals', async () => {
  const sqlite = createMigratedTestDb()
  const db = drizzle(sqlite, { schema })
  vi.doMock('../db/index.ts', () => ({ db, sqliteDb: sqlite, schema }))
  vi.doMock('./api-keys.ts', () => ({ getApiKeyNameMap: () => new Map(), getApiKeyName: () => null }))
  insertTestRequests(
    sqlite,
    Array.from({ length: 125 }, (_, i) => ({
      id: `req_${String(i).padStart(4, '0')}`,
      startedAt: 1_800_000 + (i % 7) * 1000,
      durationMs: i % 4,
      statusCode: i % 3 === 0 ? 500 : 200,
      totalTokens: i % 3 === 0 ? null : i % 5,
    })),
  )
  try {
    const { listRecentRequests } = await import('./requests')
    const { requestRoutes } = await import('./routes/requests')
    const route = requestRoutes.find((r) => r.pattern.test('/api/requests'))!
    const get = (params: URLSearchParams) =>
      route.handler(new Request(`http://dash.test/api/requests?${params}`), [] as unknown as RegExpMatchArray)
    const all = listRecentRequests({ limit: 500 })
    const time = { timeframe: 'custom' as const, from: 1_801_000, to: 1_803_000 }
    expect(listRecentRequests({ ...time, limit: 500 }).map((r) => r.id)).toEqual(
      all.filter((r) => Date.parse(r.startedAt) >= time.from && Date.parse(r.startedAt) < time.to).map((r) => r.id),
    )
    expect((await get(new URLSearchParams({ timeframe: 'custom', from: '20', to: '10' }))).status).toBe(400)

    for (const sortKey of ['startedAt', 'durationMs', 'statusCode', 'totalTokens'] satisfies SortKey[]) {
      for (const sortDir of ['asc', 'desc'] satisfies SortDir[]) {
        const sort = { sortKey, sortDir }
        const expected = [...all].sort((a, b) => compareRequests(a, b, sort))
        const ids: string[] = []
        let cursor: string | undefined
        do {
          const params = new URLSearchParams({ ...sort, limit: '13', skipMcpCount: 'true' })
          if (cursor) params.set('cursor', cursor)
          const response = await get(params)
          expect(response.status).toBe(200)
          const page = await response.json()
          ids.push(...page.requests.map((r: { id: string }) => r.id))
          cursor = page.nextCursor ?? undefined
        } while (cursor)
        expect(ids).toEqual(expected.map((r) => r.id))
      }
    }
    const sort = { sortKey: 'durationMs' as const, sortDir: 'desc' as const }
    const first = listRecentRequests({ ...sort, limit: 10 })
    const boundary = first.at(-1)!
    const cursor = requestCursor(boundary, sort)
    sqlite.prepare('delete from requests where id = ?').run(boundary.id)
    insertTestRequests(sqlite, [{ id: 'req_new', startedAt: 2_000_000, durationMs: 1000 }])
    expect(listRecentRequests({ ...sort, cursor, limit: 500 }).map((r) => r.id)).toEqual(
      all
        .filter((r) => compareRequests(r, boundary, sort) > 0)
        .sort((a, b) => compareRequests(a, b, sort))
        .map((r) => r.id),
    )
    const invalid: Record<string, string>[] = [
      { sortKey: 'invalid' },
      { sortDir: 'invalid' },
      { sortDir: 'asc' },
      { ...sort, cursor: 'req_old' },
      { ...sort, cursor: JSON.stringify(['durationMs', 'asc', 1, 'req_1']) },
      { ...sort, cursor: JSON.stringify(['durationMs', 'desc', 'bad', 'req_1']) },
    ]
    for (const params of invalid) expect((await get(new URLSearchParams(params))).status).toBe(400)
  } finally {
    sqlite.close()
    vi.doUnmock('../db/index.ts')
    vi.doUnmock('./api-keys.ts')
    vi.resetModules()
  }
})
