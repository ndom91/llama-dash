import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import * as schema from '../db/schema'

const sqlite = new Database(':memory:')
const queries: { sql: string; params: unknown[] }[] = []
const db = drizzle(sqlite, {
  schema,
  logger: { logQuery: (sql, params) => queries.push({ sql, params: [...params] }) },
})

vi.mock('../proxy/recent-bodies.ts', () => ({ getRecentBodies: vi.fn() }))
vi.mock('./api-keys.ts', () => ({ getApiKeyName: vi.fn(), getApiKeyNameMap: vi.fn() }))

describe('adjacent inference requests', () => {
  let getAdjacentIds: typeof import('./requests').getAdjacentIds

  beforeAll(async () => {
    migrate(db, { migrationsFolder: 'drizzle' })
    const insert = sqlite.prepare(
      'insert into requests (id, started_at, duration_ms, request_class, method, endpoint, status_code) values (?, 0, 0, ?, ?, ?, 200)',
    )
    for (const [id, requestClass] of [
      ['req_1', 'inference'],
      ['req_2', 'mcp_relay'],
      ['req_3', 'inference'],
      ['req_4', 'mcp_relay'],
      ['req_5', 'inference'],
    ])
      insert.run(id, requestClass, 'POST', '/v1/test')
    vi.doMock('../db/index.ts', () => ({ db, sqliteDb: sqlite, schema }))
    ;({ getAdjacentIds } = await import('./requests'))
  })

  afterAll(() => {
    vi.doUnmock('../db/index.ts')
    sqlite.close()
  })

  it('skips relay rows and handles boundaries and missing IDs', () => {
    expect(getAdjacentIds('req_3')).toEqual({ prevId: 'req_5', nextId: 'req_1' })
    expect(getAdjacentIds('req_1')).toEqual({ prevId: 'req_3', nextId: null })
    expect(getAdjacentIds('req_5')).toEqual({ prevId: null, nextId: 'req_3' })
    expect(getAdjacentIds('req_2')).toEqual({ prevId: 'req_3', nextId: 'req_1' })
    expect(getAdjacentIds('req_0')).toEqual({ prevId: 'req_1', nextId: null })
  })

  it('uses the migrated covering index for the actual queries without sorting', () => {
    queries.length = 0
    getAdjacentIds('req_3')
    expect(queries).toHaveLength(2)
    for (const query of queries) {
      const plan = sqlite.prepare(`explain query plan ${query.sql}`).all(...query.params) as { detail: string }[]
      expect(plan.map((row) => row.detail).join(' ')).toContain('USING COVERING INDEX idx_requests_class_id')
      expect(plan.map((row) => row.detail).join(' ')).not.toContain('TEMP B-TREE')
    }
  })
})
