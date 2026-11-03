import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import * as schema from '../db/schema'

const sqlite = new Database(':memory:')
const db = drizzle(sqlite, { schema })
const NOW = 1_800_000_000_000

describe('getModelActivity', () => {
  let modelEvents: typeof import('./model-events')

  beforeAll(async () => {
    migrate(db, { migrationsFolder: 'drizzle' })
    const insert = sqlite.prepare(`insert into requests
      (id, started_at, duration_ms, request_class, method, endpoint, status_code, model)
      values (?, ?, 100, ?, 'POST', '/v1/test', ?, ?)`)
    insert.run('req_1', NOW - 10_000, 'inference', 200, 'a')
    insert.run('req_2', NOW - 9_000, 'inference', 500, 'a')
    insert.run('req_3', NOW - 30 * 60_000, 'inference', 200, 'a')
    insert.run('req_4', NOW - 61 * 60_000, 'inference', 200, 'a')
    insert.run('req_5', NOW - 5_000, 'mcp_relay', 200, 'a')
    insert.run('req_6', NOW - 5_000, 'inference', 200, 'peer/b')
    vi.doMock('../db/index.ts', () => ({ db, sqliteDb: sqlite, schema }))
    modelEvents = await import('./model-events')
  })

  afterAll(() => {
    vi.doUnmock('../db/index.ts')
    sqlite.close()
  })

  it('buckets inference requests per model inside the window', () => {
    const result = modelEvents.getModelActivity(60 * 60_000, NOW)
    expect(result.bucketMs).toBe(15_000)
    expect(result.windowMs).toBe(60 * 60_000)
    expect(result.since + result.windowMs).toBeGreaterThanOrEqual(NOW)

    const a = result.models.find((m) => m.model === 'a')
    expect(a).toMatchObject({ total: 3, errors: 1, lastAt: NOW - 9_000 })
    // The two requests 1s apart land in one bucket; every bucket is an integer index in range.
    expect(a?.ticks).toHaveLength(2)
    for (const tick of a?.ticks ?? []) {
      expect(Number.isInteger(tick.bucket)).toBe(true)
      expect(tick.bucket).toBeGreaterThanOrEqual(0)
      expect(tick.bucket).toBeLessThan(modelEvents.MODEL_ACTIVITY_BUCKETS)
    }
    expect(result.models.find((m) => m.model === 'peer/b')).toMatchObject({ total: 1, errors: 0 })
  })
})
