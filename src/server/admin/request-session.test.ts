import { drizzle } from 'drizzle-orm/better-sqlite3'
import { expect, it, vi } from 'vitest'
import * as schema from '../db/schema'
import { createMigratedTestDb, insertTestRequests } from '../db/test-db'

it('finds retained legacy headers and paginates exact session matches before returning payloads', async () => {
  const sqlite = createMigratedTestDb()
  const db = drizzle(sqlite, { schema })
  vi.doMock('../db/index.ts', () => ({ db, sqliteDb: sqlite, schema }))
  vi.doMock('./api-keys.ts', () => ({ getApiKeyNameMap: () => new Map(), getApiKeyName: () => null }))
  insertTestRequests(sqlite, [
    ...Array.from({ length: 22 }, (_, i) => ({
      id: `req_${String(i).padStart(3, '0')}`,
      startedAt: i,
      sessionId: i === 0 || i === 10 || i === 21 ? null : 'session-a',
    })),
    { id: 'req_other', startedAt: 30, sessionId: 'session-ab' },
  ])
  sqlite
    .prepare('update requests set request_headers = ?, request_body = ? where id = ?')
    .run('{"x-claude-code-session-id":"session-a"}', '{"messages":[]}', 'req_000')
  sqlite
    .prepare('update requests set request_headers = ? where id in (?, ?)')
    .run('{"session-id":"session-a"}', 'req_010', 'req_021')
  const { listRequestSession } = await import('./requests')
  const { storeRecentBodies, clearRecentBodiesForTest } = await import('../proxy/recent-bodies')
  storeRecentBodies('req_000', { requestBody: 'recent', responseBody: null })
  try {
    const first = listRequestSession('req_000')!
    expect(first.sessionId).toBe('session-a')
    expect(first.requests).toHaveLength(20)
    expect(first.requests[0].payloads.requestBody).toBe('recent')
    expect(first.requests.map((row) => row.id)).toContain('req_010')
    const second = listRequestSession('req_000', first.nextCursor!)!
    expect(second.requests.map((row) => row.id)).toEqual(['req_020', 'req_021'])
    expect(second.nextCursor).toBeNull()
    expect(listRequestSession('missing')).toBeNull()
  } finally {
    clearRecentBodiesForTest()
    sqlite.close()
    vi.doUnmock('../db/index.ts')
    vi.doUnmock('./api-keys.ts')
  }
})
