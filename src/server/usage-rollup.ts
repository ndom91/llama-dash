import type Database from 'better-sqlite3'

/**
 * Daily usage rollups (`request_daily_stats`).
 *
 * The raw `requests` log is pruned after `requestLogRetentionDays`, so token and
 * usage history is aggregated per (UTC day, model, client, key) first. Rollups
 * are rebuilt from the raw log (delete + insert per day), which makes every
 * refresh idempotent. A persisted pruning watermark prevents rebuilding an
 * existing rollup from a day whose raw rows may already be partially pruned.
 * Completions update existing snapshots in the same transaction as the log.
 *
 * Functions take the SQLite handle explicitly so they can run against a
 * throwaway database in tests.
 */

const DAY_MS = 24 * 60 * 60 * 1000
const PRUNED_BEFORE_KEY = 'usage_rollup_pruned_before'
const BACKFILL_CURSOR_KEY = 'usage_rollup_backfill_cursor'

export function getPrunedBefore(sqlite: Database.Database, now: number, retentionDays: number): number {
  const row = sqlite.prepare('select value from settings where key = ?').get(PRUNED_BEFORE_KEY) as
    | { value: string }
    | undefined
  if (row) {
    const value = Number(row.value)
    if (!Number.isFinite(value)) throw new Error('Invalid usage rollup pruning watermark')
    return value
  }
  const cutoff = now - retentionDays * DAY_MS
  sqlite
    .prepare('insert into settings (key, value, updated_at) values (?, ?, ?)')
    .run(PRUNED_BEFORE_KEY, String(cutoff), now)
  return cutoff
}

export function markPrunedBefore(sqlite: Database.Database, now: number, retentionDays: number): void {
  const cutoff = Math.max(getPrunedBefore(sqlite, now, retentionDays), now - retentionDays * DAY_MS)
  sqlite
    .prepare('update settings set value = ?, updated_at = ? where key = ?')
    .run(String(cutoff), now, PRUNED_BEFORE_KEY)
}

export function backfillDays(sqlite: Database.Database, now: number, retentionDays: number): string[] {
  const prunedBefore = getPrunedBefore(sqlite, now, retentionDays)
  const cursorRow = sqlite.prepare('select value from settings where key = ?').get(BACKFILL_CURSOR_KEY) as
    | { value: string }
    | undefined
  const cursor = cursorRow?.value === 'complete' ? '' : (cursorRow?.value ?? '')
  if (!cursorRow || cursorRow.value === 'complete') {
    sqlite
      .prepare(`insert into settings (key, value, updated_at) values (?, ?, ?)
      on conflict(key) do update set value = excluded.value, updated_at = excluded.updated_at`)
      .run(BACKFILL_CURSOR_KEY, '', now)
  }
  const rawDays = sqlite
    .prepare(`select distinct date(started_at / 1000, 'unixepoch') as day
    from requests where request_class = 'inference'`)
    .all() as Array<{ day: string }>
  const rolledUp = new Set(
    (sqlite.prepare('select distinct day from request_daily_stats').all() as Array<{ day: string }>).map((r) => r.day),
  )
  const today = utcDay(now)
  return rawDays
    .map((row) => row.day)
    .filter((day) => day > cursor && day <= today && (!rolledUp.has(day) || dayToMs(day) >= prunedBefore))
    .sort()
}

export type DailyUsageRow = {
  day: string
  model: string | null
  clientName: string | null
  keyId: string | null
  statusClass: string | null
  routingAction: string | null
  clientHost: string | null
  endUserId: string | null
  requests: number
  errors: number
  promptTokens: number
  completionTokens: number
  totalTokens: number
  durationMsSum: number
  costUsdSum: number | null
  genCompletionTokens: number
  genDurationMs: number
}

/** UTC calendar day (`YYYY-MM-DD`) containing `ms`. */
export function utcDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10)
}

/** Start (ms) of the UTC day containing `ms`. */
export function utcDayStartMs(ms: number): number {
  return Math.floor(ms / DAY_MS) * DAY_MS
}

/** Start (ms) of a `YYYY-MM-DD` UTC day. */
export function dayToMs(day: string): number {
  return Date.parse(`${day}T00:00:00.000Z`)
}

/** `day` shifted by `delta` UTC days. */
export function addDays(day: string, delta: number): string {
  return utcDay(dayToMs(day) + delta * DAY_MS)
}

const OK_SQL = 'status_code < 400 and error is null'
/** `error` marks a failure logged without an HTTP error status (e.g. an aborted stream). */
const STATUS_CLASS_SQL =
  "case when error is not null and status_code < 400 then 'error' else (status_code / 100) || 'xx' end"
const GEN_SQL = `${OK_SQL} and streamed = 1 and completion_tokens > 0 and duration_ms > 0`

/**
 * Aggregates raw inference requests in `[fromMs, toMs)` into day rows. Shared by
 * the rollup writer and the live read path so both produce identical numbers.
 */
const MEASURES_SQL = `
    count(*) as requests,
    sum(case when ${OK_SQL} then 0 else 1 end) as errors,
    coalesce(sum(prompt_tokens), 0) as promptTokens,
    coalesce(sum(completion_tokens), 0) as completionTokens,
    coalesce(sum(coalesce(total_tokens, coalesce(prompt_tokens, 0) + coalesce(completion_tokens, 0))), 0) as totalTokens,
    coalesce(sum(duration_ms), 0) as durationMsSum,
    sum(cost_usd) as costUsdSum,
    coalesce(sum(case when ${GEN_SQL} then completion_tokens else 0 end), 0) as genCompletionTokens,
    coalesce(sum(case when ${GEN_SQL} then duration_ms else 0 end), 0) as genDurationMs`

const aggregateSql = (where: string) => `
  select
    date(started_at / 1000, 'unixepoch') as day,
    coalesce(routing_routed_model, model) as model,
    client_name as clientName,
    key_id as keyId,
    ${STATUS_CLASS_SQL} as statusClass,
    routing_action_type as routingAction,
    client_host as clientHost,
    end_user_id as endUserId,
    ${MEASURES_SQL}
  from requests
  where request_class = 'inference' and ${where}
  group by 1, 2, 3, 4, 5, 6, 7, 8`
const AGGREGATE_SQL = aggregateSql('started_at >= ? and started_at < ?')

const ROLLUP_COLUMNS = `day, model, clientName, keyId, statusClass, routingAction, clientHost, endUserId, requests, errors, promptTokens, completionTokens,
  totalTokens, durationMsSum, costUsdSum, genCompletionTokens, genDurationMs`
const INSERT_COLUMNS = `day, model, client_name, key_id, status_class, routing_action, client_host, end_user_id, requests, errors, prompt_tokens, completion_tokens,
  total_tokens, duration_ms_sum, cost_usd_sum, gen_completion_tokens, gen_duration_ms`

export function appendLoggedRequest(sqlite: Database.Database, id: string, startedAt: number, prunedBefore: number) {
  const day = utcDay(startedAt)
  if (!sqlite.prepare('select 1 from request_daily_stats where day = ? limit 1').get(day)) {
    if (utcDayStartMs(startedAt) < prunedBefore) rebuildDailyStats(sqlite, [day])
    return
  }
  sqlite
    .prepare(
      `insert into request_daily_stats (${INSERT_COLUMNS}) select ${ROLLUP_COLUMNS} from (${aggregateSql('id = ?')})`,
    )
    .run(id)
}

/** Rebuilds the rollup rows of the given UTC days from the raw request log. */
export function rebuildDailyStats(sqlite: Database.Database, days: ReadonlyArray<string>): void {
  if (days.length === 0) return
  const remove = sqlite.prepare('delete from request_daily_stats where day = ?')
  const insert = sqlite.prepare(
    `insert into request_daily_stats (${INSERT_COLUMNS}) select ${ROLLUP_COLUMNS} from (${AGGREGATE_SQL})`,
  )
  sqlite.transaction(() => {
    for (const day of days) {
      const start = dayToMs(day)
      remove.run(day)
      insert.run(start, start + DAY_MS)
    }
  })()
}

export function backfillDay(sqlite: Database.Database, day: string, now: number): void {
  sqlite.transaction(() => {
    rebuildDailyStats(sqlite, [day])
    sqlite.prepare('update settings set value = ?, updated_at = ? where key = ?').run(day, now, BACKFILL_CURSOR_KEY)
  })()
}

export function finishBackfill(sqlite: Database.Database, now: number): void {
  sqlite
    .prepare('update settings set value = ?, updated_at = ? where key = ?')
    .run('complete', now, BACKFILL_CURSOR_KEY)
}

type RefreshOptions = {
  now?: number
  retentionDays: number
}

/**
 * Brings the rollup up to date for today and yesterday. A day that already has
 * rollup rows is only rebuilt if it starts at or after the recorded pruning cutoff.
 */
export function refreshDailyStats(sqlite: Database.Database, options: RefreshOptions): string[] {
  const now = options.now ?? Date.now()
  const prunedBefore = getPrunedBefore(sqlite, now, options.retentionDays)
  const today = utcDay(now)
  const candidates = new Set([addDays(today, -1), today])

  const rolledUp = new Set(
    (sqlite.prepare('select distinct day from request_daily_stats').all() as Array<{ day: string }>).map((r) => r.day),
  )
  const days = [...candidates]
    .filter((day) => day <= today)
    .filter((day) => !rolledUp.has(day) || dayToMs(day) >= prunedBefore)
    .sort()
  rebuildDailyStats(sqlite, days)
  return days
}

type LoadOptions = {
  fromDay: string
  toDay: string
  now?: number
  retentionDays: number
}

/**
 * Day rows for `[fromDay, toDay]` (inclusive). Today and yesterday are read live
 * from the raw log (the rollup lags by up to an hour); older days come from the
 * rollup, which is the only place they survive after pruning.
 */
export function loadDailyRows(sqlite: Database.Database, options: LoadOptions): DailyUsageRow[] {
  const now = options.now ?? Date.now()
  const today = utcDay(now)
  const yesterday = addDays(today, -1)
  const liveFrom = dayToMs(yesterday) >= getPrunedBefore(sqlite, now, options.retentionDays) ? yesterday : today
  const rollupTo = options.toDay < liveFrom ? options.toDay : addDays(liveFrom, -1)

  const rows: DailyUsageRow[] = []
  if (options.fromDay <= rollupTo) {
    rows.push(
      ...(sqlite
        .prepare(
          `select day, model, client_name as clientName, key_id as keyId, status_class as statusClass,
            routing_action as routingAction, client_host as clientHost, end_user_id as endUserId, requests, errors,
            prompt_tokens as promptTokens, completion_tokens as completionTokens, total_tokens as totalTokens,
            duration_ms_sum as durationMsSum, cost_usd_sum as costUsdSum,
            gen_completion_tokens as genCompletionTokens, gen_duration_ms as genDurationMs
           from request_daily_stats where day >= ? and day <= ?`,
        )
        .all(options.fromDay, rollupTo) as DailyUsageRow[]),
    )
  }

  const liveStart = options.fromDay > liveFrom ? options.fromDay : liveFrom
  if (liveStart <= options.toDay) {
    rows.push(
      ...(sqlite.prepare(AGGREGATE_SQL).all(dayToMs(liveStart), dayToMs(options.toDay) + DAY_MS) as DailyUsageRow[]),
    )
  }
  return rows
}

export type SessionUsageRow = Omit<
  DailyUsageRow,
  'day' | 'model' | 'clientName' | 'keyId' | 'statusClass' | 'routingAction' | 'clientHost' | 'endUserId'
> & {
  sessionId: string | null
}

/**
 * Usage per session id for `[fromDay, toDay]`, from the raw request log only:
 * session ids are near-unique per conversation, so they are not rolled up and
 * disappear with request-log retention.
 */
export function loadSessionRows(
  sqlite: Database.Database,
  options: { fromDay: string; toDay: string },
): SessionUsageRow[] {
  return sqlite
    .prepare(
      `select
        session_id as sessionId,
        ${MEASURES_SQL}
      from requests
      where request_class = 'inference' and started_at >= ? and started_at < ?
      group by session_id`,
    )
    .all(dayToMs(options.fromDay), dayToMs(options.toDay) + DAY_MS) as SessionUsageRow[]
}
