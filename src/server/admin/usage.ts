import type Database from 'better-sqlite3'
import {
  type ApiUsageBreakdownRow,
  type ApiUsagePanel,
  type ApiUsageReport,
  type ApiUsageSummary,
  type ApiUsageTotals,
  USAGE_PERIODS,
  type UsageDimension,
  type UsagePanels,
  type UsagePeriodDays,
} from '../../lib/schemas/usage'
import {
  addDays,
  type DailyUsageRow,
  loadDailyRows,
  loadSessionRows,
  type SessionUsageRow,
  utcDay,
  utcDayStartMs,
} from '../usage-rollup.ts'

const DAY_MS = 24 * 60 * 60 * 1000
const HOUR_MS = 60 * 60 * 1000

export function parseUsageDays(value: string | null): UsagePeriodDays {
  const n = Number(value)
  return USAGE_PERIODS.find((days) => days === n) ?? 7
}

type ReportOptions = {
  days: UsagePeriodDays
  now?: number
  retentionDays: number
  keyNames: ReadonlyMap<string, string>
  panels: UsagePanels
}

/** Rows shown per panel before the rest is folded into an "others" row. */
const PANEL_TOP_ROWS = 10

type MeasureRow = Pick<
  DailyUsageRow,
  'requests' | 'errors' | 'promptTokens' | 'completionTokens' | 'totalTokens' | 'genCompletionTokens' | 'genDurationMs'
>

const ROLLUP_DIMENSION: Record<Exclude<UsageDimension, 'session'>, (row: DailyUsageRow) => string | null> = {
  client: (row) => row.clientName,
  key: (row) => row.keyId,
  model: (row) => row.model,
  status: (row) => row.statusClass,
  routing: (row) => row.routingAction,
  host: (row) => row.clientHost,
  endUser: (row) => row.endUserId,
}

/**
 * Usage for the last `days` UTC calendar days (today included) and the same
 * number of days before that, for the period-over-period delta.
 */
export function getUsageReport(sqlite: Database.Database, options: ReportOptions): ApiUsageReport {
  const now = options.now ?? Date.now()
  const to = utcDay(now)
  const from = addDays(to, -(options.days - 1))
  const previousFrom = addDays(from, -options.days)

  const rows = loadDailyRows(sqlite, { fromDay: previousFrom, toDay: to, now, retentionDays: options.retentionDays })
  const current = rows.filter((row) => row.day >= from)
  const previous = rows.filter((row) => row.day < from)

  const daily = dayRange(from, options.days).map((day) => ({ day, requests: 0, promptTokens: 0, completionTokens: 0 }))
  const dayIndex = new Map(daily.map((entry, i) => [entry.day, i]))
  for (const row of current) {
    const entry = daily[dayIndex.get(row.day) ?? -1]
    if (!entry) continue
    entry.requests += row.requests
    entry.promptTokens += row.promptTokens
    entry.completionTokens += row.completionTokens
  }

  const oldest = sqlite.prepare('select min(day) as day from request_daily_stats').get() as { day: string | null }
  const oldestRaw = sqlite
    .prepare("select min(started_at) as startedAt from requests where request_class = 'inference'")
    .get() as { startedAt: number | null }
  const oldestDay = minDay(oldest.day, oldestRaw.startedAt != null ? utcDay(oldestRaw.startedAt) : null)

  return {
    days: options.days,
    from,
    to,
    oldestDay,
    totals: sumTotals(current),
    previous: sumTotals(previous),
    daily,
    retentionDays: options.retentionDays,
    panels: options.panels.map((dimension) => {
      if (dimension === 'session') {
        return buildPanel(
          dimension,
          groupBy(loadSessionRows(sqlite, { fromDay: from, toDay: to }), (row: SessionUsageRow) => row.sessionId),
          () => null,
          options.days > options.retentionDays,
        )
      }
      const labelFor =
        dimension === 'key'
          ? (keyId: string | null) => (keyId != null ? (options.keyNames.get(keyId) ?? null) : null)
          : () => null
      return buildPanel(dimension, groupBy(current, ROLLUP_DIMENSION[dimension]), labelFor, false)
    }),
  }
}

type SummaryOptions = {
  now?: number
  retentionDays: number
}

/**
 * Generated (completion) tokens for the dashboard cards: today so far against
 * yesterday up to the same time of day, and the last 7 / 30 UTC days against
 * the windows before them.
 */
export function getUsageSummary(sqlite: Database.Database, options: SummaryOptions): ApiUsageSummary {
  const now = options.now ?? Date.now()
  const todayStart = utcDayStartMs(now)
  const today = utcDay(now)

  const hours = Math.floor((now - todayStart) / HOUR_MS) + 1
  const hourly = new Array<number>(hours).fill(0)
  const hourRows = sqlite
    .prepare(
      `select cast((started_at - ?) / ${HOUR_MS} as integer) as hour, coalesce(sum(completion_tokens), 0) as tokens
       from requests
       where request_class = 'inference' and started_at >= ? and started_at <= ?
       group by hour`,
    )
    .all(todayStart, todayStart, now) as Array<{ hour: number; tokens: number }>
  for (const row of hourRows) if (row.hour >= 0 && row.hour < hours) hourly[row.hour] = row.tokens

  const yesterdaySoFar = sqlite
    .prepare(
      `select coalesce(sum(completion_tokens), 0) as tokens
       from requests
       where request_class = 'inference' and started_at >= ? and started_at <= ?`,
    )
    .get(todayStart - DAY_MS, now - DAY_MS) as { tokens: number }

  const rows = loadDailyRows(sqlite, {
    fromDay: addDays(today, -59),
    toDay: today,
    now,
    retentionDays: options.retentionDays,
  })
  const perDay = new Map<string, number>()
  for (const row of rows) perDay.set(row.day, (perDay.get(row.day) ?? 0) + row.completionTokens)

  const window = (days: number) => {
    const series = dayRange(addDays(today, -(days - 1)), days).map((day) => perDay.get(day) ?? 0)
    const previous = dayRange(addDays(today, -(2 * days - 1)), days).reduce(
      (acc, day) => acc + (perDay.get(day) ?? 0),
      0,
    )
    return { completionTokens: series.reduce((acc, n) => acc + n, 0), previous, series }
  }

  return {
    today: {
      completionTokens: hourly.reduce((acc, n) => acc + n, 0),
      previous: yesterdaySoFar.tokens,
      series: hourly,
    },
    days7: window(7),
    days30: window(30),
  }
}

function breakdownRow(
  value: string | null,
  label: string | null,
  group: ReadonlyArray<MeasureRow>,
): ApiUsageBreakdownRow {
  const genTokens = sum(group, (row) => row.genCompletionTokens)
  const genMs = sum(group, (row) => row.genDurationMs)
  return {
    value,
    label,
    ...tokenCounts(group),
    errors: sum(group, (row) => row.errors),
    avgGenTokPerSec: genTokens > 0 && genMs > 0 ? Math.round((genTokens / genMs) * 1000 * 10) / 10 : null,
  }
}

function buildPanel<R extends MeasureRow>(
  dimension: UsageDimension,
  groups: Array<[string | null, R[]]>,
  labelFor: (value: string | null) => string | null,
  partial: boolean,
): ApiUsagePanel {
  const top = groups.slice(0, PANEL_TOP_ROWS)
  const rest = groups.slice(PANEL_TOP_ROWS)
  return {
    dimension,
    values: groups.length,
    rows: top.map(([value, group]) => breakdownRow(value, labelFor(value), group)),
    others:
      rest.length > 0
        ? breakdownRow(
            null,
            `${rest.length} more`,
            rest.flatMap(([, group]) => group),
          )
        : null,
    partial,
  }
}

function dayRange(from: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => addDays(from, i))
}

function minDay(a: string | null, b: string | null): string | null {
  if (a == null) return b
  if (b == null) return a
  return a < b ? a : b
}

function sum<R>(rows: ReadonlyArray<R>, pick: (row: R) => number): number {
  let total = 0
  for (const row of rows) total += pick(row)
  return total
}

function tokenCounts(rows: ReadonlyArray<MeasureRow>) {
  return {
    requests: sum(rows, (row) => row.requests),
    promptTokens: sum(rows, (row) => row.promptTokens),
    completionTokens: sum(rows, (row) => row.completionTokens),
    totalTokens: sum(rows, (row) => row.totalTokens),
  }
}

function sumTotals(rows: ReadonlyArray<DailyUsageRow>): ApiUsageTotals {
  const priced = rows.filter((row) => row.costUsdSum != null)
  return {
    ...tokenCounts(rows),
    errors: sum(rows, (row) => row.errors),
    costUsd: priced.length > 0 ? sum(priced, (row) => row.costUsdSum ?? 0) : null,
  }
}

/** Groups rows by `key`, ordered by total tokens, then requests, then name. */
function groupBy<R extends MeasureRow, K extends string | null>(
  rows: ReadonlyArray<R>,
  key: (row: R) => K,
): Array<[K, R[]]> {
  const groups = new Map<K, R[]>()
  for (const row of rows) {
    const k = key(row)
    const group = groups.get(k)
    if (group) group.push(row)
    else groups.set(k, [row])
  }
  return [...groups.entries()]
    .map(([k, group]) => ({
      k,
      group,
      tokens: sum(group, (r) => r.totalTokens),
      requests: sum(group, (r) => r.requests),
    }))
    .sort(
      (a, b) => b.tokens - a.tokens || b.requests - a.requests || String(a.k ?? '￿').localeCompare(String(b.k ?? '￿')),
    )
    .map(({ k, group }) => [k, group])
}
