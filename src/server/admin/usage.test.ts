import type Database from 'better-sqlite3'
import { beforeEach, describe, expect, it } from 'vitest'
import type { UsageDimension } from '../../lib/schemas/usage'
import { backfillTestUsage, createMigratedTestDb, insertTestRequests } from '../db/test-db'
import { extractAttribution } from '../proxy/attribution'
import { utcDayStartMs } from '../usage-rollup'
import { getUsageReport, getUsageSummary, parseUsageDays } from './usage'

const DAY_MS = 24 * 60 * 60 * 1000
const HOUR_MS = 60 * 60 * 1000
// 2026-03-10T15:30:00Z
const NOW = Date.UTC(2026, 2, 10, 15, 30)
const TODAY = utcDayStartMs(NOW)
const KEY_NAMES = new Map([['k1', 'laptop']])

function report(
  sqlite: Database.Database,
  days: 1 | 7 | 30 | 90,
  panels: [UsageDimension, UsageDimension, UsageDimension] = ['client', 'model', 'key'],
) {
  return getUsageReport(sqlite, { days, now: NOW, retentionDays: 30, keyNames: KEY_NAMES, panels })
}

function counts(row: { requests: number; promptTokens: number; completionTokens: number; totalTokens: number }) {
  return [row.requests, row.promptTokens, row.completionTokens, row.totalTokens]
}

describe('parseUsageDays', () => {
  it('accepts the supported periods and defaults to 7', () => {
    expect(parseUsageDays('1')).toBe(1)
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

  it('reports exact rolling 24-hour windows and excludes the end boundary', () => {
    insertTestRequests(sqlite, [
      { id: 'current-start', startedAt: NOW - DAY_MS, promptTokens: 100, completionTokens: 50, sessionId: 'current' },
      {
        id: 'previous-end',
        startedAt: NOW - DAY_MS - 1,
        promptTokens: 20,
        completionTokens: 10,
        sessionId: 'previous',
      },
      { id: 'previous-start', startedAt: NOW - 2 * DAY_MS, promptTokens: 1, completionTokens: 2 },
      { id: 'older', startedAt: NOW - 2 * DAY_MS - 1, promptTokens: 999, completionTokens: 999 },
      { id: 'future', startedAt: NOW, promptTokens: 999, completionTokens: 999 },
    ])
    backfillTestUsage(sqlite, NOW, 30)
    const result = report(sqlite, 1, ['session', 'client', 'model'])
    expect(result).toMatchObject({
      days: 1,
      from: '2026-03-09',
      to: '2026-03-10',
      totals: { requests: 1, promptTokens: 100, completionTokens: 50 },
      previous: { requests: 2, promptTokens: 21, completionTokens: 12 },
      daily: [
        { day: '2026-03-09', requests: 1, promptTokens: 100, completionTokens: 50 },
        { day: '2026-03-10', requests: 0, promptTokens: 0, completionTokens: 0 },
      ],
      comparisonIncomplete: false,
    })
    expect(result.panels[0].rows.map((row) => row.value)).toEqual(['current'])
    const summary = getUsageSummary(sqlite, { now: NOW, retentionDays: 30 })
    expect(summary.hours24.completionTokens).toBe(result.totals.completionTokens)
    expect(summary.hours24.previous).toBe(result.previous.completionTokens)
  })

  it('marks the rolling comparison incomplete while the pruning watermark overlaps it', () => {
    backfillTestUsage(sqlite, NOW, 30)
    sqlite.prepare("update settings set value = ? where key = 'usage_rollup_pruned_before'").run(String(NOW - DAY_MS))
    expect(report(sqlite, 1).comparisonIncomplete).toBe(true)
    expect(getUsageSummary(sqlite, { now: NOW, retentionDays: 30 }).hours24.comparisonIncomplete).toBe(true)
    expect(report(sqlite, 7).comparisonIncomplete).toBe(false)
  })

  it('groups Claude CLI attribution in live and rolled-up usage', () => {
    const { clientName } = extractAttribution(new Headers({ 'user-agent': 'claude-cli/2.1.311 (external, cli)' }), {
      clientNameHeader: null,
      endUserIdHeader: null,
      sessionIdHeader: null,
    })
    insertTestRequests(sqlite, [
      { id: 'live', startedAt: TODAY + HOUR_MS, clientName, completionTokens: 10 },
      { id: 'rolled', startedAt: TODAY - 2 * DAY_MS, clientName, completionTokens: 20 },
      { id: 'other', startedAt: TODAY + HOUR_MS, clientName: null, completionTokens: 5 },
    ])
    backfillTestUsage(sqlite, NOW, 30)
    expect(report(sqlite, 7).panels[0].rows.map((row) => [row.value, row.requests, row.completionTokens])).toEqual([
      ['claude-code', 2, 30],
      [null, 1, 5],
    ])
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
      panels: [
        { dimension: 'client', values: 0, rows: [], others: null, partial: false },
        { dimension: 'model', values: 0, rows: [], others: null, partial: false },
        { dimension: 'key', values: 0, rows: [], others: null, partial: false },
      ],
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
    backfillTestUsage(sqlite, NOW, 30)

    const r = report(sqlite, 7)
    expect(r.totals).toMatchObject({ requests: 2, promptTokens: 101, completionTokens: 52, totalTokens: 153 })
    expect(r.previous).toMatchObject({ requests: 2, promptTokens: 20, completionTokens: 10, totalTokens: 30 })
    expect(r.daily.at(-1)).toEqual({ day: '2026-03-10', requests: 1, promptTokens: 100, completionTokens: 50 })
    expect(r.daily[0]).toEqual({ day: '2026-03-04', requests: 1, promptTokens: 1, completionTokens: 2 })
    expect(r.oldestDay).toBe('2026-02-24')
  })

  it('keeps history that only survives in the rollup', () => {
    insertTestRequests(sqlite, [{ id: 'old', startedAt: TODAY - 50 * DAY_MS, completionTokens: 40 }])
    backfillTestUsage(sqlite, NOW, 60)
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
    backfillTestUsage(sqlite, NOW, 30)

    const r = report(sqlite, 7)
    const [byClient, byModel, byKey] = r.panels
    expect(byClient.rows.map((row) => [row.value, row.label, ...counts(row)])).toEqual([
      ['chat-ui', null, 2, 20, 400, 420],
      [null, null, 2, 20, 60, 80],
    ])
    expect(byModel.rows).toEqual([
      {
        value: 'model-a',
        label: null,
        requests: 2,
        errors: 0,
        promptTokens: 20,
        completionTokens: 400,
        totalTokens: 420,
        avgGenTokPerSec: 200,
      },
      {
        value: 'model-b',
        label: null,
        requests: 2,
        errors: 1,
        promptTokens: 20,
        completionTokens: 60,
        totalTokens: 80,
        avgGenTokPerSec: 50,
      },
    ])
    expect(byKey.rows.map((row) => [row.value, row.label, ...counts(row)])).toEqual([
      ['k1', 'laptop', 2, 20, 400, 420],
      [null, null, 1, 10, 50, 60],
      ['deleted-key', null, 1, 10, 10, 20],
    ])
    expect(r.totals.errors).toBe(1)
  })

  it('reports no generation speed when there were no successful streamed requests', () => {
    insertTestRequests(sqlite, [{ id: 'a', startedAt: TODAY + HOUR_MS, streamed: false }])
    expect(report(sqlite, 7).panels[1].rows[0].avgGenTokPerSec).toBeNull()
  })

  it('breaks usage down by status class, routing action, client host and end user', () => {
    insertTestRequests(sqlite, [
      { id: 'a', startedAt: TODAY + HOUR_MS, clientHost: 'laptop', endUserId: 'alice', routingActionType: 'continue' },
      { id: 'b', startedAt: TODAY + HOUR_MS, statusCode: 502, clientHost: 'laptop' },
      { id: 'c', startedAt: TODAY - 3 * DAY_MS, statusCode: 200, error: 'stream aborted', endUserId: 'bob' },
    ])
    backfillTestUsage(sqlite, NOW, 30)

    const [status, routing, host] = report(sqlite, 7, ['status', 'routing', 'host']).panels
    expect(status.rows.map((row) => [row.value, row.requests, row.errors])).toEqual([
      ['2xx', 1, 0],
      ['5xx', 1, 1],
      ['error', 1, 1],
    ])
    expect(routing.rows.map((row) => [row.value, row.requests])).toEqual([
      [null, 2],
      ['continue', 1],
    ])
    expect(host.rows.map((row) => [row.value, row.requests])).toEqual([
      ['laptop', 2],
      [null, 1],
    ])
    const endUser = report(sqlite, 7, ['endUser', 'model', 'key']).panels[0]
    expect(endUser.rows.map((row) => [row.value, row.requests])).toEqual([
      ['alice', 1],
      ['bob', 1],
      [null, 1],
    ])
  })

  it('keeps the top rows and folds the rest into an others row', () => {
    insertTestRequests(
      sqlite,
      Array.from({ length: 13 }, (_, i) => ({
        id: `r${i}`,
        startedAt: TODAY + HOUR_MS,
        clientName: `app-${String(i).padStart(2, '0')}`,
        completionTokens: 100 + i,
      })),
    )
    const clients = report(sqlite, 7).panels[0]
    expect(clients.values).toBe(13)
    expect(clients.rows).toHaveLength(10)
    expect(clients.rows[0].value).toBe('app-12')
    expect(clients.others).toMatchObject({ value: null, label: '3 more', requests: 3, completionTokens: 303 })
  })

  it('computes sessions from the raw log only and flags periods longer than retention', () => {
    insertTestRequests(sqlite, [
      { id: 'a', startedAt: TODAY + HOUR_MS, sessionId: 's-1', completionTokens: 5 },
      { id: 'b', startedAt: TODAY - 2 * DAY_MS, sessionId: 's-1', completionTokens: 7 },
      { id: 'c', startedAt: TODAY - 2 * DAY_MS, sessionId: 's-2' },
      { id: 'd', startedAt: TODAY - 2 * DAY_MS },
      // before the 7-day period
      { id: 'e', startedAt: TODAY - 9 * DAY_MS, sessionId: 's-1' },
      { id: 'mcp', startedAt: TODAY, requestClass: 'mcp_relay', sessionId: 's-1' },
    ])
    backfillTestUsage(sqlite, NOW, 30)

    const sessions = report(sqlite, 7, ['session', 'model', 'key']).panels[0]
    expect(sessions.rows.map((row) => [row.value, row.requests, row.completionTokens])).toEqual([
      ['s-1', 2, 12],
      ['s-2', 1, 20],
      [null, 1, 20],
    ])
    expect(sessions.partial).toBe(false)
    expect(report(sqlite, 90, ['session', 'model', 'key']).panels[0].partial).toBe(true)
    expect(report(sqlite, 90, ['client', 'model', 'key']).panels[0].partial).toBe(false)
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
    expect(s.hours24).toEqual({
      completionTokens: 0,
      previous: 0,
      series: new Array(24).fill(0),
      comparisonIncomplete: false,
    })
    expect(s.days7).toEqual({ completionTokens: 0, previous: 0, series: new Array(7).fill(0) })
    expect(s.days30.series).toHaveLength(30)
  })

  it('compares the last 24 hours with the preceding 24 hours', () => {
    insertTestRequests(sqlite, [
      { id: 't1', startedAt: TODAY + 30 * 60 * 1000, completionTokens: 5 },
      { id: 't2', startedAt: TODAY + 15 * HOUR_MS, completionTokens: 7 },
      { id: 'y-before', startedAt: TODAY - DAY_MS + 10 * HOUR_MS, completionTokens: 3 },
      { id: 'y-after', startedAt: TODAY - DAY_MS + 20 * HOUR_MS, completionTokens: 100 },
    ])
    backfillTestUsage(sqlite, NOW, 30)

    const s = getUsageSummary(sqlite, { now: NOW, retentionDays: 30 })
    expect(s.hours24.completionTokens).toBe(112)
    expect(s.hours24.previous).toBe(3)
    expect(s.hours24.series[9]).toBe(5)
    expect(s.hours24.series[23]).toBe(7)
    expect(s.today.completionTokens).toBe(12)
    expect(s.today.previous).toBe(3)
    expect(s.days7.completionTokens).toBe(115)
    expect(s.days7.series.at(-1)).toBe(12)
    expect(s.days7.series.at(-2)).toBe(103)
  })

  it('preserves rolling and legacy today boundaries at a fractional hour', () => {
    const now = TODAY + 15 * HOUR_MS + 30 * 60_000
    insertTestRequests(sqlite, [
      { id: 'old', startedAt: now - 2 * DAY_MS - 1, completionTokens: 1000 },
      { id: 'previous-start', startedAt: now - 2 * DAY_MS, completionTokens: 1 },
      { id: 'yesterday-start', startedAt: TODAY - DAY_MS, completionTokens: 2 },
      { id: 'rolling-start', startedAt: now - DAY_MS, completionTokens: 4 },
      { id: 'today-start', startedAt: TODAY, completionTokens: 8 },
      { id: 'now', startedAt: now, completionTokens: 16 },
      { id: 'future', startedAt: now + 1, completionTokens: 1000 },
    ])
    const s = getUsageSummary(sqlite, { now, retentionDays: 30 })
    expect(s.hours24.completionTokens).toBe(12)
    expect(s.hours24.previous).toBe(3)
    expect(s.hours24.series[0]).toBe(4)
    expect(s.today.completionTokens).toBe(24)
    expect(s.today.previous).toBe(6)
    expect(s.today.series[0]).toBe(8)
    expect(s.today.series[15]).toBe(16)
  })

  it('compares 7 and 30 day windows with the windows before them', () => {
    insertTestRequests(sqlite, [
      { id: 'a', startedAt: TODAY - 8 * DAY_MS, completionTokens: 11 },
      { id: 'b', startedAt: TODAY - 40 * DAY_MS, completionTokens: 13 },
    ])
    backfillTestUsage(sqlite, NOW, 60)

    const s = getUsageSummary(sqlite, { now: NOW, retentionDays: 30 })
    expect(s.days7).toMatchObject({ completionTokens: 0, previous: 11 })
    expect(s.days30).toMatchObject({ completionTokens: 11, previous: 13 })
  })
})
