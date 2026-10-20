import type Database from 'better-sqlite3'
import { beforeEach, describe, expect, it } from 'vitest'
import { createMigratedTestDb, insertTestRequests } from './db/test-db'
import { loadDailyRows, rebuildDailyStats, refreshDailyStats, utcDay, utcDayStartMs } from './usage-rollup'

const DAY_MS = 24 * 60 * 60 * 1000
const HOUR_MS = 60 * 60 * 1000
// 2026-03-10T15:00:00Z
const NOW = Date.UTC(2026, 2, 10, 15)
const TODAY = utcDayStartMs(NOW)

function rollupRows(sqlite: Database.Database) {
  return sqlite
    .prepare(
      `select day, model, client_name as clientName, key_id as keyId, requests, errors,
        prompt_tokens as promptTokens, completion_tokens as completionTokens, total_tokens as totalTokens,
        duration_ms_sum as durationMsSum, cost_usd_sum as costUsdSum,
        gen_completion_tokens as genCompletionTokens, gen_duration_ms as genDurationMs
       from request_daily_stats order by day, model, client_name, key_id`,
    )
    .all() as Array<Record<string, unknown>>
}

describe('utc day helpers', () => {
  it('formats UTC calendar days and their start', () => {
    expect(utcDay(Date.UTC(2026, 0, 1, 23, 59, 59))).toBe('2026-01-01')
    expect(utcDay(Date.UTC(2026, 0, 2))).toBe('2026-01-02')
    expect(utcDayStartMs(Date.UTC(2026, 0, 2, 13, 5))).toBe(Date.UTC(2026, 0, 2))
  })
})

describe('request daily stats rollup', () => {
  let sqlite: Database.Database

  beforeEach(() => {
    sqlite = createMigratedTestDb()
  })

  it('groups inference requests per UTC day, routed model, client and key', () => {
    insertTestRequests(sqlite, [
      { id: 'a', startedAt: TODAY + HOUR_MS, clientName: 'app', keyId: 'k1', durationMs: 2000, costUsd: 0.01 },
      { id: 'b', startedAt: TODAY + 2 * HOUR_MS, clientName: 'app', keyId: 'k1', durationMs: 1000, costUsd: 0.02 },
      // routed model wins over requested model
      { id: 'c', startedAt: TODAY + 3 * HOUR_MS, model: 'alias', routedModel: 'model-b', clientName: 'app' },
      // errors are counted but excluded from generation speed
      { id: 'd', startedAt: TODAY + 4 * HOUR_MS, statusCode: 500, completionTokens: 0, promptTokens: 5 },
      // non-streamed requests are excluded from generation speed
      { id: 'e', startedAt: TODAY + 5 * HOUR_MS, streamed: false, clientName: 'app', keyId: 'k1' },
      // MCP relay traffic is not inference usage
      { id: 'f', startedAt: TODAY + 6 * HOUR_MS, requestClass: 'mcp_relay', model: null },
      // previous day
      { id: 'g', startedAt: TODAY - 1, clientName: 'app', keyId: 'k1' },
    ])

    rebuildDailyStats(sqlite, [utcDay(TODAY), utcDay(TODAY - DAY_MS)])

    expect(rollupRows(sqlite)).toEqual([
      {
        day: '2026-03-09',
        model: 'model-a',
        clientName: 'app',
        keyId: 'k1',
        requests: 1,
        errors: 0,
        promptTokens: 10,
        completionTokens: 20,
        totalTokens: 30,
        durationMsSum: 1000,
        costUsdSum: null,
        genCompletionTokens: 20,
        genDurationMs: 1000,
      },
      {
        day: '2026-03-10',
        model: 'model-a',
        clientName: null,
        keyId: null,
        requests: 1,
        errors: 1,
        promptTokens: 5,
        completionTokens: 0,
        totalTokens: 5,
        durationMsSum: 1000,
        costUsdSum: null,
        genCompletionTokens: 0,
        genDurationMs: 0,
      },
      {
        day: '2026-03-10',
        model: 'model-a',
        clientName: 'app',
        keyId: 'k1',
        requests: 3,
        errors: 0,
        promptTokens: 30,
        completionTokens: 60,
        totalTokens: 90,
        durationMsSum: 4000,
        costUsdSum: expect.closeTo(0.03, 6),
        genCompletionTokens: 40,
        genDurationMs: 3000,
      },
      {
        day: '2026-03-10',
        model: 'model-b',
        clientName: 'app',
        keyId: null,
        requests: 1,
        errors: 0,
        promptTokens: 10,
        completionTokens: 20,
        totalTokens: 30,
        durationMsSum: 1000,
        costUsdSum: null,
        genCompletionTokens: 20,
        genDurationMs: 1000,
      },
    ])
  })

  it('derives total tokens when the upstream did not report one', () => {
    insertTestRequests(sqlite, [{ id: 'a', startedAt: TODAY, promptTokens: 7, completionTokens: 3, totalTokens: null }])
    rebuildDailyStats(sqlite, [utcDay(TODAY)])
    expect(rollupRows(sqlite)[0]).toMatchObject({ totalTokens: 10 })
  })

  it('is idempotent when rerun', () => {
    insertTestRequests(sqlite, [
      { id: 'a', startedAt: TODAY + HOUR_MS },
      { id: 'b', startedAt: TODAY - DAY_MS + HOUR_MS },
    ])
    refreshDailyStats(sqlite, { now: NOW, retentionDays: 30 })
    const first = rollupRows(sqlite)
    refreshDailyStats(sqlite, { now: NOW, retentionDays: 30 })
    refreshDailyStats(sqlite, { now: NOW, retentionDays: 30, backfill: true })
    expect(rollupRows(sqlite)).toEqual(first)
    expect(first).toHaveLength(2)
  })

  it('picks up requests that arrived since the last refresh', () => {
    insertTestRequests(sqlite, [{ id: 'a', startedAt: TODAY + HOUR_MS }])
    refreshDailyStats(sqlite, { now: NOW, retentionDays: 30 })
    insertTestRequests(sqlite, [{ id: 'b', startedAt: TODAY + 2 * HOUR_MS }])
    refreshDailyStats(sqlite, { now: NOW + HOUR_MS, retentionDays: 30 })
    expect(rollupRows(sqlite)).toEqual([expect.objectContaining({ day: '2026-03-10', requests: 2 })])
  })

  it('backfills every day still present in the request log on startup', () => {
    insertTestRequests(sqlite, [
      { id: 'a', startedAt: TODAY - 20 * DAY_MS },
      { id: 'b', startedAt: TODAY - 5 * DAY_MS },
      { id: 'c', startedAt: TODAY + HOUR_MS },
    ])
    // the hourly refresh only touches today and yesterday
    refreshDailyStats(sqlite, { now: NOW, retentionDays: 30 })
    expect(rollupRows(sqlite).map((r) => r.day)).toEqual(['2026-03-10'])

    refreshDailyStats(sqlite, { now: NOW, retentionDays: 30, backfill: true })
    expect(rollupRows(sqlite).map((r) => r.day)).toEqual(['2026-02-18', '2026-03-05', '2026-03-10'])
  })

  it('keeps rollups for requests removed by retention pruning', () => {
    insertTestRequests(sqlite, [
      { id: 'old', startedAt: TODAY - 40 * DAY_MS + HOUR_MS },
      { id: 'new', startedAt: TODAY + HOUR_MS },
    ])
    refreshDailyStats(sqlite, { now: NOW, retentionDays: 60, backfill: true })
    sqlite.prepare('delete from requests where id = ?').run('old')

    refreshDailyStats(sqlite, { now: NOW, retentionDays: 30 })
    refreshDailyStats(sqlite, { now: NOW, retentionDays: 30, backfill: true })

    expect(rollupRows(sqlite).map((r) => [r.day, r.requests])).toEqual([
      ['2026-01-29', 1],
      ['2026-03-10', 1],
    ])
  })

  it('does not overwrite a complete rollup with a partially pruned day', () => {
    // A day straddling the retention cutoff: its early rows are already pruned.
    const edgeDay = TODAY - 30 * DAY_MS
    insertTestRequests(sqlite, [
      { id: 'early', startedAt: edgeDay + HOUR_MS },
      { id: 'late', startedAt: edgeDay + 20 * HOUR_MS },
    ])
    rebuildDailyStats(sqlite, [utcDay(edgeDay)])
    sqlite.prepare('delete from requests where id = ?').run('early')

    refreshDailyStats(sqlite, { now: NOW, retentionDays: 30, backfill: true })

    expect(rollupRows(sqlite)).toEqual([expect.objectContaining({ day: utcDay(edgeDay), requests: 2 })])
  })

  it('loads recent days live from requests and older days from the rollup', () => {
    insertTestRequests(sqlite, [
      { id: 'a', startedAt: TODAY - 3 * DAY_MS },
      { id: 'b', startedAt: TODAY - DAY_MS },
    ])
    refreshDailyStats(sqlite, { now: NOW, retentionDays: 30, backfill: true })
    // arrives after the last refresh: only visible through the live path
    insertTestRequests(sqlite, [{ id: 'c', startedAt: TODAY + 2 * HOUR_MS }])
    // pruned from the raw log: only visible through the rollup
    sqlite.prepare('delete from requests where id = ?').run('a')

    const rows = loadDailyRows(sqlite, {
      fromDay: utcDay(TODAY - 6 * DAY_MS),
      toDay: utcDay(TODAY),
      now: NOW,
      retentionDays: 30,
    })
    expect(rows.map((r) => [r.day, r.requests]).sort()).toEqual([
      ['2026-03-07', 1],
      ['2026-03-09', 1],
      ['2026-03-10', 1],
    ])
  })
})
