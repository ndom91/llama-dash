import Database from 'better-sqlite3'
import { readFileSync } from 'node:fs'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { afterAll, beforeAll, expect, it, vi } from 'vitest'

const sqlite = new Database(':memory:')
const queries: { sql: string; params: number[] }[] = []
const evict = vi.fn()
const day = 86_400_000

beforeAll(async () => {
  migrate(drizzle(sqlite), { migrationsFolder: 'drizzle' })
  vi.doMock('./db/index.ts', () => ({
    sqliteDb: {
      prepare: (sql: string) => ({
        all: (...params: number[]) => {
          queries.push({ sql, params })
          return sqlite.prepare(sql).all(...params)
        },
        run: (...params: number[]) => {
          queries.push({ sql, params })
          return sqlite.prepare(sql).run(...params)
        },
      }),
    },
  }))
  vi.doMock('./admin/settings.ts', () => ({
    getPrivacySettings: () => ({
      requestLogRetentionDays: 30,
      mcpRelaySuccessRetentionDays: 7,
      mcpRelayErrorRetentionDays: 10,
      bodyRetentionDays: 3,
    }),
  }))
  vi.doMock('./proxy/recent-bodies.ts', () => ({ deleteRecentBodies: evict }))
})

afterAll(() => {
  vi.doUnmock('./db/index.ts')
  vi.doUnmock('./admin/settings.ts')
  vi.doUnmock('./proxy/recent-bodies.ts')
  sqlite.close()
})

it('uses the migrated partial index and preserves retention and cache eviction', async () => {
  const now = 100 * day
  sqlite.exec('drop index idx_requests_payload_started_at')
  const insert = sqlite.prepare(`insert into requests
    (id, started_at, duration_ms, request_class, method, endpoint, status_code, error,
     request_headers, request_body, response_headers, response_body)
    values (?, ?, 1, ?, 'POST', '/v1/test', ?, ?, ?, ?, ?, ?)`)
  insert.run('inference-deleted', now - 31 * day, 'inference', 200, null, 'x', null, null, null)
  insert.run('mcp-success-deleted', now - 8 * day, 'mcp_relay', 200, null, null, 'x', null, null)
  insert.run('mcp-error-deleted', now - 11 * day, 'mcp_relay', 200, 'failed', null, null, 'x', null)
  insert.run('body-cleared', now - 4 * day, 'inference', 200, null, null, null, null, 'x')
  insert.run('cutoff-kept', now - 3 * day, 'inference', 200, null, 'x', null, null, null)
  insert.run('empty-kept', now - 4 * day, 'inference', 200, null, null, null, null, null)
  insert.run('recent-kept', now - day, 'inference', 200, null, null, 'x', null, null)
  sqlite.exec(readFileSync('drizzle/0043_common_victor_mancha.sql', 'utf8'))

  const { pruneRequestLogs } = await import('./request-log-maintenance')
  expect(pruneRequestLogs(now)).toEqual({
    inferenceDeleted: 1,
    mcpRelaySuccessDeleted: 1,
    mcpRelayErrorDeleted: 1,
    bodiesCleared: 1,
  })
  expect(evict.mock.calls.map(([id]) => id).sort()).toEqual([
    'body-cleared',
    'inference-deleted',
    'mcp-error-deleted',
    'mcp-success-deleted',
  ])
  expect(sqlite.prepare('select id, response_body from requests order by id').all()).toEqual([
    { id: 'body-cleared', response_body: null },
    { id: 'cutoff-kept', response_body: null },
    { id: 'empty-kept', response_body: null },
    { id: 'recent-kept', response_body: null },
  ])
  expect(sqlite.prepare('select request_headers from requests where id = ?').get('cutoff-kept')).toEqual({
    request_headers: 'x',
  })
  for (const query of [queries[0], queries[4]]) {
    const plan = sqlite.prepare(`explain query plan ${query.sql}`).all(...query.params) as { detail: string }[]
    expect(plan.map((row) => row.detail).join(' ')).toContain('idx_requests_payload_started_at')
  }
  evict.mockClear()
  expect(pruneRequestLogs(now)).toEqual({
    inferenceDeleted: 0,
    mcpRelaySuccessDeleted: 0,
    mcpRelayErrorDeleted: 0,
    bodiesCleared: 0,
  })
  expect(evict).not.toHaveBeenCalled()
})
