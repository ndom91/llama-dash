import { mkdtempSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { it, vi } from 'vitest'
import * as schema from '../db/schema'

// Opt-in: REQUEST_BENCHMARK=1 pnpm test src/server/admin/requests.bench.test.ts
// Uses a disposable disk DB; never opens the configured application database.
it.skipIf(process.env.REQUEST_BENCHMARK !== '1')(
  'measures request queries against a disk-backed retained log',
  async () => {
    const directory = mkdtempSync(join(tmpdir(), 'llama-dash-requests-bench-'))
    const filename = join(directory, 'requests.db')
    const sqlite = new Database(filename)
    sqlite.pragma('journal_mode = WAL')
    sqlite.pragma('cache_size = -16384')
    let last: { sql: string; params: unknown[] } | undefined
    const db = drizzle(sqlite, {
      schema,
      logger: {
        logQuery: (sql, params) => {
          last = { sql, params }
        },
      },
    })
    vi.doMock('../db/index.ts', () => ({ db, sqliteDb: sqlite, schema }))
    vi.doMock('./api-keys.ts', () => ({ getApiKeyNameMap: () => new Map(), getApiKeyName: () => null }))
    try {
      migrate(drizzle(sqlite), { migrationsFolder: resolve('drizzle') })
      const count = Number(process.env.REQUEST_BENCHMARK_ROWS ?? 100_000)
      const now = Date.now()
      const body = JSON.stringify({ content: 'example '.repeat(256) })
      const insert = sqlite.prepare(`insert into requests
      (id, started_at, duration_ms, request_class, method, endpoint, model, status_code,
       total_tokens, client_name, client_host, session_id, request_body, response_body)
      values (?, ?, ?, ?, 'POST', '/v1/chat/completions', ?, ?, ?, ?, ?, ?, ?, ?)`)
      sqlite.transaction(() => {
        for (let i = 0; i < count; i++)
          insert.run(
            `req_${String(i).padStart(10, '0')}`,
            now - Math.floor(((count - i) * 30 * 86_400_000) / count),
            (i * 7919) % 60_000,
            i % 50 === 0 ? 'mcp_relay' : 'inference',
            `model-${i % 30}`,
            i % 101 === 0 ? 500 : 200,
            i % 7 === 0 ? null : (i * 313) % 32000,
            `client-${i % 10}`,
            `host-${i % 50}`,
            `session-${Math.floor(i / 20)}`,
            i % 3 === 0 ? body : null,
            i % 3 === 0 ? body : null,
          )
      })()
      sqlite.pragma('wal_checkpoint(TRUNCATE)')
      sqlite.exec('analyze')
      const { listRecentRequests, getFilteredRequestHistogram, requestFilterOptions, countMatchingRequests } =
        await import('./requests')
      const cases: [string, () => unknown][] = [
        ['time desc', () => listRecentRequests({ limit: 51, sortKey: 'startedAt', sortDir: 'desc' })],
        ['duration desc', () => listRecentRequests({ limit: 51, sortKey: 'durationMs', sortDir: 'desc' })],
        ['status asc', () => listRecentRequests({ limit: 51, sortKey: 'statusCode', sortDir: 'asc' })],
        ['tokens desc', () => listRecentRequests({ limit: 51, sortKey: 'totalTokens', sortDir: 'desc' })],
        [
          'duration with MCP',
          () => listRecentRequests({ limit: 51, sortKey: 'durationMs', sortDir: 'desc', includeMcp: true }),
        ],
        [
          'search hit',
          () => listRecentRequests({ limit: 51, search: 'client-9', sortKey: 'startedAt', sortDir: 'desc' }),
        ],
        [
          'search miss',
          () => listRecentRequests({ limit: 51, search: 'no-matching-request', sortKey: 'startedAt', sortDir: 'desc' }),
        ],
        [
          'model + time sort',
          () => listRecentRequests({ limit: 51, models: ['model-1'], sortKey: 'startedAt', sortDir: 'desc' }),
        ],
        ['last hour', () => listRecentRequests({ limit: 51, timeframe: '1h', sortKey: 'startedAt', sortDir: 'desc' })],
        [
          'custom day',
          () =>
            listRecentRequests({
              limit: 51,
              timeframe: 'custom',
              from: now - 2 * 86_400_000,
              to: now - 86_400_000,
              sortKey: 'startedAt',
              sortDir: 'desc',
            }),
        ],
        ['all-history chart', () => getFilteredRequestHistogram({ timeframe: 'all' })],
        ['filter options', requestFilterOptions],
        ['all-match count', () => countMatchingRequests({ timeframe: 'all' })],
        ['no-match text count', () => countMatchingRequests({ timeframe: 'all', search: 'no-matching-request' })],
      ]
      const measure = (phase: string) => {
        const results = cases.map(([name, run]) => {
          sqlite.pragma('shrink_memory')
          const start = performance.now()
          run()
          const firstMs = performance.now() - start
          const times = Array.from({ length: 7 }, () => {
            const start = performance.now()
            run()
            return performance.now() - start
          }).sort((a, b) => a - b)
          const plan = last ? sqlite.prepare(`explain query plan ${last.sql}`).all(...last.params) : []
          return { name, firstMs: +firstMs.toFixed(2), medianMs: +times[3].toFixed(2), plan }
        })
        process.stdout.write(
          `${JSON.stringify({
            phase,
            rows: count,
            databaseMiB: +(statSync(filename).size / 1024 ** 2).toFixed(1),
            results,
          })}\n`,
        )
      }
      measure('current migrations')
    } finally {
      sqlite.close()
      rmSync(directory, { recursive: true, force: true })
      vi.doUnmock('../db/index.ts')
      vi.doUnmock('./api-keys.ts')
      vi.resetModules()
    }
  },
  120_000,
)
