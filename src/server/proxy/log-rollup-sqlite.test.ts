import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { afterAll, expect, it, vi } from 'vitest'
import * as schema from '../db/schema'
import type { RequestLogInput } from './log'

const sqlite = new Database(':memory:')
const db = drizzle(sqlite, { schema })
const now = Date.UTC(2026, 2, 10, 15)
const yesterday = Date.UTC(2026, 2, 9)

afterAll(() => {
  vi.useRealTimers()
  sqlite.close()
})

it('persists late inference and its frozen-day rollup together', async () => {
  migrate(db, { migrationsFolder: 'drizzle' })
  vi.useFakeTimers()
  vi.setSystemTime(now)
  vi.doMock('../db/index.ts', () => ({ db, sqliteDb: sqlite, schema }))
  vi.doMock('../admin/settings.ts', () => ({
    getPrivacySettings: () => ({
      requestLogRetentionDays: 1,
      mcpRelaySuccessRetentionDays: 7,
      mcpRelayErrorRetentionDays: 30,
      bodyRetentionDays: 3,
      mcpRelayPersistSuccessBodies: false,
    }),
    getBodyLogLimits: () => ({ maxBytes: 0 }),
  }))
  vi.doMock('../admin/api-keys.ts', () => ({ getApiKeyName: () => null }))
  vi.doMock('../admin/events.ts', () => ({ publishAdminEvent: vi.fn() }))
  vi.doMock('../admin/requests.ts', () => ({ toRequestRow: () => ({}) }))
  vi.doMock('../pricing.ts', () => ({ computeCostUsd: () => null }))
  vi.doMock('./recent-bodies.ts', () => ({ storeRecentBodies: vi.fn(), deleteRecentBodies: vi.fn() }))
  vi.doMock('../proxy/recent-bodies.ts', () => ({ storeRecentBodies: vi.fn(), deleteRecentBodies: vi.fn() }))
  const { writeRequestLogNow } = await import('./log')
  const row: RequestLogInput = {
    startedAt: yesterday + 14 * 3_600_000,
    durationMs: 1000,
    requestClass: 'inference',
    method: 'POST',
    endpoint: '/v1/chat/completions',
    model: 'model',
    statusCode: 200,
    promptTokens: 0,
    completionTokens: 100,
    totalTokens: 100,
    cacheCreationTokens: null,
    cacheReadTokens: null,
    streamed: false,
    error: null,
    requestHeaders: null,
    requestBody: null,
    responseHeaders: null,
    responseBody: null,
    streamCloseMs: null,
    keyId: null,
    clientHost: null,
    clientName: null,
    endUserId: null,
    sessionId: null,
    routingRuleId: null,
    routingRuleName: null,
    routingActionType: null,
    routingAuthMode: null,
    routingPreserveAuthorization: false,
    routingTargetType: null,
    routingTargetBaseUrl: null,
    routingTargetCredentialId: null,
    routingRequestedModel: null,
    routingRoutedModel: null,
    routingRejectReason: null,
  }
  writeRequestLogNow(row)
  const { startRequestLogMaintenance, pruneRequestLogs } = await import('../request-log-maintenance')
  startRequestLogMaintenance()
  vi.advanceTimersByTime(1)
  expect(pruneRequestLogs(now).inferenceDeleted).toBe(1)
  writeRequestLogNow({ ...row, startedAt: yesterday + 23 * 3_600_000, completionTokens: 200, totalTokens: 200 })
  expect(sqlite.prepare('select sum(completion_tokens) as n from request_daily_stats').get()).toEqual({ n: 300 })
  const { loadDailyRows } = await import('../usage-rollup')
  const usage = loadDailyRows(sqlite, { fromDay: '2026-03-09', toDay: '2026-03-09', now, retentionDays: 1 })
  expect(usage.reduce((total, entry) => total + entry.completionTokens, 0)).toBe(300)
  sqlite.exec(
    "create trigger reject_rollup before insert on request_daily_stats begin select raise(abort, 'rollup failure'); end",
  )
  expect(() => writeRequestLogNow(row)).toThrow('rollup failure')
  expect(sqlite.prepare('select count(*) as n from requests').get()).toEqual({ n: 1 })
  expect(sqlite.prepare('select sum(completion_tokens) as n from request_daily_stats').get()).toEqual({ n: 300 })
})
