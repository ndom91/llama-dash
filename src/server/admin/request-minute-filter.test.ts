import { drizzle } from 'drizzle-orm/better-sqlite3'
import { expect, it, vi } from 'vitest'
import * as schema from '../db/schema'
import { createMigratedTestDb, insertTestRequests } from '../db/test-db'

it('paginates disjoint selected minutes with exclusive end boundaries', async () => {
  const sqlite = createMigratedTestDb()
  const db = drizzle(sqlite, { schema })
  vi.doMock('../db/index.ts', () => ({ db, sqliteDb: sqlite, schema }))
  vi.doMock('./api-keys.ts', () => ({ getApiKeyNameMap: () => new Map(), getApiKeyName: () => null }))
  const { listRecentRequests, countRecentMcpRequests } = await import('./requests')
  const base = 1_800_000
  insertTestRequests(sqlite, [
    { id: 'req_1', startedAt: base },
    { id: 'req_2', startedAt: base + 59_999 },
    { id: 'req_3', startedAt: base + 60_000 },
    { id: 'req_4', startedAt: base + 120_000 },
    { id: 'req_5', startedAt: base + 120_001, requestClass: 'mcp_relay' },
  ])
  const minutes = [base, base + 120_000]
  const first = listRecentRequests({ limit: 2, includeMcp: true, minutes })
  const second = listRecentRequests({ limit: 2, includeMcp: true, minutes, cursor: first.at(-1)?.id })
  expect([...first, ...second].map((row) => row.id)).toEqual(['req_5', 'req_4', 'req_2', 'req_1'])
  expect(countRecentMcpRequests({ minutes })).toBe(1)
  expect(countRecentMcpRequests({ minutes: [base] })).toBe(0)
  sqlite.close()
  vi.doUnmock('../db/index.ts')
  vi.doUnmock('./api-keys.ts')
})
