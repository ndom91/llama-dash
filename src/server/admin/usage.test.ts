import type Database from 'better-sqlite3'
import { beforeEach, describe, expect, it } from 'vitest'
import { createMigratedTestDb, insertTestRequests } from '../db/test-db'
import { refreshDailyStats, utcDayStartMs } from '../usage-rollup'
import { getUsageReport, getUsageSummary, parseUsageDays } from './usage'

const DAY_MS = 24 * 60 * 60 * 1000
const HOUR_MS = 60 * 60 * 1000
// 2026-03-10T15:30:00Z
const NOW = Date.UTC(2026, 2, 10, 15, 30)
const TODAY = utcDayStartMs(NOW)
const KEY_NAMES = new Map([['k1', 'laptop']])

function report(sqlite: Database.Database, days: 7 | 30 | 90) {
  return getUsageReport(sqlite, { days, now: NOW, retentionDays: 30, keyNames: KEY_NAMES })
}

describe('parseUsageDays', () => {
  it('accepts the supported periods and defaults to 7', () => {
    expect(parseUsageDays('30')).toBe(30)
    expect(parseUsageDays('90')).toBe(90)
    expect(parseUsageDays(null)).toBe(7)
    expect(parseUsageDays('12')).toBe(7)
  })
})

describe('usage report', () => {
  let sqlite: Database.Database

  beforeEach(() => {
    sqlite = createMigratedTestDb()
  })

  it('returns zeroed totals and a zero-filled series for an empty database', () => {
    const r = report(sqlite, 7)
    expect(r).toMatchObject({
      days: 7,
      from: '2026-03-04',
      to: '2026-03-10',
      oldestDay: null,
      totals: { requests: 0, errors: 0, promptTokens: 0, completionTokens: 0, totalTokens: 0, costUsd: null },
      previous: { requests: 0, totalTokens: 0 },
      byClient: [],
      byModel: [],
      byKey: [],
    })
    expect(r.daily).toHaveLength(7)
    expect(r.daily[0]).toEqual({ day: '2026-03-04', requests: 0, promptTokens: 0, completionTokens: 0 })
    expect(r.daily.every((d) => d.promptTokens === 0 && d.completionTokens === 0)).toBe(true)
  })

  it('splits the current period from the previous one by UTC day', () => {
    insertTestRequests(sqlite, [
      // current 7-day period: 2026-03-04 .. 2026-03-10
      { id: 'today', startedAt: TODAY + HOUR_MS, promptTokens: 100, completionTokens: 50 },
      { id: 'first-day', startedAt: TODAY - 6 * DAY_MS, promptTokens: 1, completionTokens: 2 },
      // previous period: 2026-02-25 .. 2026-03-03
      { id: 'prev-last', startedAt: TODAY - 7 * DAY_MS + 23 * HOUR_MS, promptTokens: 10, completionTokens: 5 },
      { id: 'prev-first', startedAt: TODAY - 13 * DAY_MS, promptTokens: 10, completionTokens: 5 },
      // outside both
      { id: 'older', startedAt: TODAY - 14 * DAY_MS, promptTokens: 1000, completionTokens: 1000 },
    ])
    refreshDailyStats(sqlite, { now: NOW, retentionDays: 30, backfill: true })

    const r = report(sqlite, 7)
    expect(r.totals).toMatchObject({ requests: 2, promptTokens: 101, completionTokens: 52, totalTokens: 153 })
    expect(r.previous).toMatchObject({ requests: 2, promptTokens: 20, completionTokens: 10, totalTokens: 30 })
    expect(r.daily.at(-1)).toEqual({ day: '2026-03-10', requests: 1, promptTokens: 100, completionTokens: 50 })
    expect(r.daily[0]).toEqual({ day: '2026-03-04', requests: 1, promptTokens: 1, completionTokens: 2 })
    expect(r.oldestDay).toBe('2026-02-24')
  })

  it('keeps history that only survives in the rollup', () => {
    insertTestRequests(sqlite, [{ id: 'old', startedAt: TODAY - 50 * DAY_MS, completionTokens: 40 }])
    refreshDailyStats(sqlite, { now: NOW, retentionDays: 60, backfill: true })
    sqlite.prepare('delete from requests').run()

    expect(report(sqlite, 90).totals.completionTokens).toBe(40)
    expect(report(sqlite, 30).previous.completionTokens).toBe(40)
  })

  it('breaks usage down by client, model and key with unattributed traffic kept', () => {
    insertTestRequests(sqlite, [
      { id: 'a', startedAt: TODAY + HOUR_MS, clientName: 'chat-ui', keyId: 'k1', completionTokens: 300 },
      { id: 'b', startedAt: TODAY + HOUR_MS, clientName: 'chat-ui', keyId: 'k1', completionTokens: 100 },
      { id: 'c', startedAt: TODAY + HOUR_MS, clientName: null, keyId: null, model: 'model-b', completionTokens: 50 },
      {
        id: 'd',
        startedAt: TODAY - 2 * DAY_MS,
        clientName: null,
        keyId: 'deleted-key',
        model: 'alias',
        routedModel: 'model-b',
        completionTokens: 10,
        statusCode: 500,
      },
    ])
    refreshDailyStats(sqlite, { now: NOW, retentionDays: 30, backfill: true })

    const r = report(sqlite, 7)
    expect(r.byClient).toEqual([
      { clientName: 'chat-ui', requests: 2, promptTokens: 20, completionTokens: 400, totalTokens: 420 },
      { clientName: null, requests: 2, promptTokens: 20, completionTokens: 60, totalTokens: 80 },
    ])
    expect(r.byModel).toEqual([
      {
        model: 'model-a',
        requests: 2,
        errors: 0,
        promptTokens: 20,
        completionTokens: 400,
        totalTokens: 420,
        avgGenTokPerSec: 200,
      },
      {
        model: 'model-b',
        requests: 2,
        errors: 1,
        promptTokens: 20,
        completionTokens: 60,
        totalTokens: 80,
        avgGenTokPerSec: 50,
      },
    ])
    expect(r.byKey).toEqual([
      { keyId: 'k1', keyName: 'laptop', requests: 2, promptTokens: 20, completionTokens: 400, totalTokens: 420 },
      { keyId: null, keyName: null, requests: 1, promptTokens: 10, completionTokens: 50, totalTokens: 60 },
      { keyId: 'deleted-key', keyName: null, requests: 1, promptTokens: 10, completionTokens: 10, totalTokens: 20 },
    ])
    expect(r.totals.errors).toBe(1)
  })

  it('reports no generation speed when there were no successful streamed requests', () => {
    insertTestRequests(sqlite, [{ id: 'a', startedAt: TODAY + HOUR_MS, streamed: false }])
    expect(report(sqlite, 7).byModel[0].avgGenTokPerSec).toBeNull()
  })

  it('sums cost only when some request was priced', () => {
    insertTestRequests(sqlite, [
      { id: 'a', startedAt: TODAY + HOUR_MS, costUsd: 0.25 },
      { id: 'b', startedAt: TODAY + HOUR_MS },
    ])
    expect(report(sqlite, 7).totals.costUsd).toBeCloseTo(0.25)
    expect(report(sqlite, 7).previous.costUsd).toBeNull()
  })
})

describe('usage summary', () => {
  let sqlite: Database.Database

  beforeEach(() => {
    sqlite = createMigratedTestDb()
  })

  it('returns zeros for an empty database', () => {
    const s = getUsageSummary(sqlite, { now: NOW, retentionDays: 30 })
    expect(s.today).toEqual({ completionTokens: 0, previous: 0, series: new Array(16).fill(0) })
    expect(s.days7).toEqual({ completionTokens: 0, previous: 0, series: new Array(7).fill(0) })
    expect(s.days30.series).toHaveLength(30)
  })

  it('compares today with yesterday up to the same time of day', () => {
    insertTestRequests(sqlite, [
      { id: 't1', startedAt: TODAY + 30 * 60 * 1000, completionTokens: 5 },
      { id: 't2', startedAt: TODAY + 15 * HOUR_MS, completionTokens: 7 },
      { id: 'y-before', startedAt: TODAY - DAY_MS + 10 * HOUR_MS, completionTokens: 3 },
      { id: 'y-after', startedAt: TODAY - DAY_MS + 20 * HOUR_MS, completionTokens: 100 },
    ])
    refreshDailyStats(sqlite, { now: NOW, retentionDays: 30, backfill: true })

    const s = getUsageSummary(sqlite, { now: NOW, retentionDays: 30 })
    expect(s.today.completionTokens).toBe(12)
    expect(s.today.previous).toBe(3)
    expect(s.today.series[0]).toBe(5)
    expect(s.today.series[15]).toBe(7)
    expect(s.days7.completionTokens).toBe(115)
    expect(s.days7.series.at(-1)).toBe(12)
    expect(s.days7.series.at(-2)).toBe(103)
  })

  it('compares 7 and 30 day windows with the windows before them', () => {
    insertTestRequests(sqlite, [
      { id: 'a', startedAt: TODAY - 8 * DAY_MS, completionTokens: 11 },
      { id: 'b', startedAt: TODAY - 40 * DAY_MS, completionTokens: 13 },
    ])
    refreshDailyStats(sqlite, { now: NOW, retentionDays: 60, backfill: true })

    const s = getUsageSummary(sqlite, { now: NOW, retentionDays: 30 })
    expect(s.days7).toMatchObject({ completionTokens: 0, previous: 11 })
    expect(s.days30).toMatchObject({ completionTokens: 11, previous: 13 })
  })
})
