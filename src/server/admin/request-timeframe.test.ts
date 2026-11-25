import { drizzle } from 'drizzle-orm/better-sqlite3'
import { expect, it, vi } from 'vitest'
import * as schema from '../db/schema'
import { createMigratedTestDb, insertTestRequests } from '../db/test-db'

it('bounds long-range charts and shares time, class and filter semantics with the list', async () => {
  const sqlite = createMigratedTestDb()
  const db = drizzle(sqlite, { schema })
  vi.doMock('../db/index.ts', () => ({ db, sqliteDb: sqlite, schema }))
  vi.doMock('./api-keys.ts', () => ({ getApiKeyNameMap: () => new Map(), getApiKeyName: () => null }))
  const base = Date.UTC(2026, 10, 1)
  insertTestRequests(
    sqlite,
    Array.from({ length: 1000 }, (_, i) => ({
      id: `req_${String(i).padStart(4, '0')}`,
      startedAt: base + i * 3_600_000,
      model: i % 2 ? 'other' : 'target',
      statusCode: i % 3 ? 200 : 500,
      requestClass: i % 5 ? 'inference' : 'mcp_relay',
    })),
  )
  try {
    const { getFilteredRequestHistogram, listRecentRequests, countMatchingRequests } = await import('./requests')
    const { requestRoutes } = await import('./routes/requests')
    for (const includeMcp of [false, true]) {
      const opts = {
        timeframe: 'custom' as const,
        from: base,
        to: base + 1000 * 3_600_000,
        models: { mode: 'include' as const, values: ['target'] },
        status: 'err' as const,
        includeMcp,
      }
      const histogram = getFilteredRequestHistogram(opts)
      expect(countMatchingRequests(opts)).toBe(listRecentRequests({ ...opts, limit: 2000 }).length)
      expect(histogram.buckets.length).toBeLessThanOrEqual(240)
      const rows = listRecentRequests({ ...opts, limit: 2000 })
      expect(histogram.buckets.reduce((sum, b) => sum + b.total, 0)).toBe(rows.length)
      expect(histogram.buckets.reduce((sum, b) => sum + b.errors, 0)).toBe(rows.length)
      expect(histogram.earliestRetainedAt).toBe(includeMcp ? base : base + 3_600_000)
      const ranges = [
        { from: base, to: base + 72 * 3_600_000 },
        { from: base + 100 * 3_600_000, to: base + 200 * 3_600_000 },
      ]
      expect(listRecentRequests({ ...opts, ranges, limit: 2000 }).map((r) => r.id)).toEqual(
        rows
          .filter((r) =>
            ranges.some((range) => Date.parse(r.startedAt) >= range.from && Date.parse(r.startedAt) < range.to),
          )
          .map((r) => r.id),
      )
      expect(countMatchingRequests({ ...opts, ranges, cursor: 'req_any' })).toBe(
        listRecentRequests({ ...opts, ranges, limit: 2000 }).length,
      )
      // Selecting chart ranges must not shrink the context chart itself.
      expect(getFilteredRequestHistogram({ ...opts, ranges }).buckets).toEqual(histogram.buckets)
    }
    const route = requestRoutes.find((r) => r.pattern.test('/api/requests/histogram'))!
    const get = (params: URLSearchParams) =>
      route.handler(new Request(`http://dash.test/api/requests/histogram?${params}`), [] as unknown as RegExpMatchArray)
    expect(
      (
        await get(
          new URLSearchParams({ timeframe: 'custom', from: String(base), to: String(base + 1000), ranges: 'bad' }),
        )
      ).status,
    ).toBe(400)
    const response = await get(new URLSearchParams({ timeframe: 'custom', from: String(base), to: String(base + 1) }))
    expect(response.status).toBe(200)
    expect((await response.json()).buckets.reduce((n: number, b: { total: number }) => n + b.total, 0)).toBe(0)
    const empty = getFilteredRequestHistogram({ timeframe: 'custom', from: base + 1, to: base + 2 })
    expect(empty.buckets).toHaveLength(1)
    expect(empty.buckets[0].total).toBe(0)
  } finally {
    sqlite.close()
    vi.doUnmock('../db/index.ts')
    vi.doUnmock('./api-keys.ts')
    vi.resetModules()
  }
})
