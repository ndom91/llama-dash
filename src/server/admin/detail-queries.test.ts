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

describe('key and model detail queries', () => {
  let keyDetail: typeof import('./key-detail')
  let modelDetail: typeof import('./model-detail')

  beforeAll(async () => {
    migrate(db, { migrationsFolder: 'drizzle' })
    const insert = sqlite.prepare(`insert into requests
      (id, started_at, duration_ms, method, endpoint, status_code, key_id, model, total_tokens, completion_tokens,
       request_headers, request_body, response_headers, response_body)
      values (?, ?, 1000, 'POST', '/v1/test', ?, ?, ?, 10, 4, 'secret', 'secret', 'secret', 'secret')`)
    const now = Date.now()
    insert.run('req_1', now - 60_000, 200, 'key_1', 'model')
    insert.run('req_2', now - 30_000, 500, 'key_1', 'peer/model')
    insert.run('req_3', now - 31 * 60_000, 200, 'key_1', 'model')
    insert.run('req_4', now - 20_000, 200, 'key_2', 'other')
    vi.doMock('../db/index.ts', () => ({ db, sqliteDb: sqlite, schema }))
    vi.doMock('../inference/backend.ts', () => ({ inferenceBackend: { modelLogNames: (id: string) => [id] } }))
    keyDetail = await import('./key-detail')
    modelDetail = await import('./model-detail')
  })

  afterAll(() => {
    vi.doUnmock('../db/index.ts')
    vi.doUnmock('../inference/backend.ts')
    sqlite.close()
  })

  it('uses the migrated key/time index for both real 30-minute queries', () => {
    queries.length = 0
    expect(keyDetail.getKeyStats('key_1')).toMatchObject({ totalRequests: 2, errorCount: 1, totalCompletionTokens: 8 })
    expect(keyDetail.getKeyModelBreakdown('key_1')).toEqual([
      { model: 'model', requestCount: 2, totalTokens: 20, errorCount: 1 },
    ])
    expect(queries).toHaveLength(2)
    for (const query of queries) {
      const plan = sqlite.prepare(`explain query plan ${query.sql}`).all(...query.params) as { detail: string }[]
      const details = plan.map((row) => row.detail).join(' ')
      expect(details).toContain('idx_requests_key_started_at')
      expect(details).not.toContain('TEMP B-TREE')
    }
  })

  it('returns paginated key and peer-model summaries without selecting payloads', () => {
    queries.length = 0
    const key = keyDetail.getKeyRequests('key_1', 2)
    const model = modelDetail.getModelRequests('model', 2)
    for (const result of [key, model]) {
      expect(result.rows.map((row) => row.id)).toEqual(['req_3', 'req_2'])
      expect(result.nextCursor).toBe('req_2')
      expect(result.rows[1]).toMatchObject({ model: 'peer/model', statusCode: 500, totalTokens: 10, keyName: null })
    }
    expect(keyDetail.getKeyRequests('key_1', 2, key.nextCursor ?? undefined).rows.map((r) => r.id)).toEqual(['req_1'])
    expect(modelDetail.getModelRequests('model', 2, model.nextCursor ?? undefined).rows.map((r) => r.id)).toEqual([
      'req_1',
    ])
    for (const query of queries) {
      expect(query.sql).not.toMatch(/request_body|response_body|request_headers|response_headers/)
    }
  })
})
