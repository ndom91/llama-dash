import Database from 'better-sqlite3'
import { readFileSync } from 'node:fs'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { afterAll, beforeAll, expect, it, vi } from 'vitest'

const sqlite = new Database(':memory:')
const queries: { sql: string; params: (string | number)[] }[] = []
const evict = vi.fn()
const day = 86_400_000

beforeAll(async () => {
  migrate(drizzle(sqlite), { migrationsFolder: 'drizzle' })
  vi.doMock('./db/index.ts', () => ({
    sqliteDb: {
      transaction: (fn: () => unknown) => sqlite.transaction(fn),
      prepare: (sql: string) => ({
        all: (...params: (string | number)[]) => {
          queries.push({ sql, params })
          return sqlite.prepare(sql).all(...params)
        },
        run: (...params: (string | number)[]) => {
          queries.push({ sql, params })
          return sqlite.prepare(sql).run(...params)
        },
        get: (...params: (string | number)[]) => {
          queries.push({ sql, params })
          return sqlite.prepare(sql).get(...params)
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

  vi.useFakeTimers()
  vi.setSystemTime(now)
  const { pruneRequestLogs, startRequestLogMaintenance } = await import('./request-log-maintenance')
  startRequestLogMaintenance()
  vi.advanceTimersByTime(100)
  queries.length = 0
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
  const selection = queries.find((query) => query.sql.includes('select id\n'))
  const clearing = queries.find((query) => query.sql.includes('set request_headers = null'))
  expect(selection).toBeDefined()
  expect(clearing).toBeDefined()
  for (const query of [selection!, clearing!]) {
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
  const watermark = sqlite.prepare('select value from settings where key = ?').get('usage_rollup_pruned_before')
  sqlite.exec(
    "create trigger reject_inference_delete before delete on requests when old.request_class = 'inference' begin select raise(abort, 'delete failure'); end",
  )
  expect(() => pruneRequestLogs(now + 40 * day)).toThrow('delete failure')
  expect(sqlite.prepare('select value from settings where key = ?').get('usage_rollup_pruned_before')).toEqual(
    watermark,
  )
  expect(sqlite.prepare('select count(*) as n from requests').get()).toEqual({ n: 4 })
  vi.clearAllTimers()
  vi.useRealTimers()
})
