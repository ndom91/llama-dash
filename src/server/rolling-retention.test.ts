import { drizzle } from 'drizzle-orm/better-sqlite3'
import { expect, it, vi } from 'vitest'
import * as schema from './db/schema'
import { createMigratedTestDb, insertTestRequests } from './db/test-db'

it('retains two days of inference rows even when an existing setting was one day', async () => {
  const sqlite = createMigratedTestDb()
  const db = drizzle(sqlite, { schema })
  const now = Date.UTC(2026, 9, 27, 15)
  const day = 86_400_000
  sqlite
    .prepare('insert into settings (key, value, updated_at) values (?, ?, ?)')
    .run('request_log_retention_days', '1', now)
  insertTestRequests(sqlite, [
    { id: 'older', startedAt: now - 2 * day - 1 },
    { id: 'boundary', startedAt: now - 2 * day },
    { id: 'recent', startedAt: now - day - 1 },
  ])
  vi.useFakeTimers()
  vi.setSystemTime(now)
  vi.doMock('./db/index.ts', () => ({ db, sqliteDb: sqlite, schema }))
  vi.doMock('./proxy/recent-bodies.ts', () => ({ deleteRecentBodies: vi.fn() }))
  const { pruneRequestLogs, startRequestLogMaintenance } = await import('./request-log-maintenance')
  startRequestLogMaintenance()
  vi.advanceTimersByTime(100)
  expect(pruneRequestLogs(now).inferenceDeleted).toBe(1)
  expect(sqlite.prepare('select id from requests order by id').all()).toEqual([{ id: 'boundary' }, { id: 'recent' }])
  vi.clearAllTimers()
  vi.useRealTimers()
  sqlite.close()
  vi.doUnmock('./db/index.ts')
  vi.doUnmock('./proxy/recent-bodies.ts')
})
