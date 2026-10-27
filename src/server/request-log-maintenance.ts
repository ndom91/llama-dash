import { getPrivacySettings } from './admin/settings.ts'
import { sqliteDb } from './db/index.ts'
import { deleteRecentBodies } from './proxy/recent-bodies.ts'
import { backfillDay, backfillDays, finishBackfill, markPrunedBefore, refreshDailyStats } from './usage-rollup.ts'

const DAY_MS = 24 * 60 * 60 * 1000
const MAINTENANCE_INTERVAL_MS = 60 * 60 * 1000

let started = false
let backfillComplete = false
let backfillQueue: string[] | null = null

export type RequestLogPruneResult = {
  inferenceDeleted: number
  mcpRelaySuccessDeleted: number
  mcpRelayErrorDeleted: number
  bodiesCleared: number
}

export function startRequestLogMaintenance() {
  if (started) return
  started = true
  scheduleBackfill()
  setTimeout(() => {
    pruneRequestLogsSafely()
    setInterval(pruneRequestLogsSafely, MAINTENANCE_INTERVAL_MS).unref?.()
  }, 60_000).unref?.()
}

function scheduleBackfill() {
  setTimeout(() => {
    try {
      backfillQueue ??= backfillDays(sqliteDb, Date.now(), getPrivacySettings().requestLogRetentionDays)
      const day = backfillQueue.shift()
      if (day) {
        backfillDay(sqliteDb, day, Date.now())
        scheduleBackfill()
      } else {
        finishBackfill(sqliteDb, Date.now())
        backfillComplete = true
      }
    } catch (err) {
      backfillQueue = null
      console.warn('Failed to backfill usage rollups; retrying', err)
      setTimeout(scheduleBackfill, 60_000).unref?.()
    }
  }, 0).unref?.()
}

export function pruneRequestLogs(now = Date.now()): RequestLogPruneResult {
  return pruneWithTiming(now).result
}

function pruneWithTiming(now: number) {
  let failed = false
  let rollupError: unknown
  try {
    if (!backfillComplete) throw new Error('Usage backfill is not complete; inference pruning is paused')
    refreshDailyStats(sqliteDb, { now, retentionDays: getPrivacySettings().requestLogRetentionDays })
  } catch (err) {
    failed = true
    rollupError = err
  }
  const result = runRequestLogPrune(now, !failed)
  if (failed) throw rollupError
  return result
}

function runRequestLogPrune(now: number, allowInference: boolean) {
  const settings = getPrivacySettings()
  const inferenceCutoff = now - settings.requestLogRetentionDays * DAY_MS
  const mcpSuccessCutoff = now - settings.mcpRelaySuccessRetentionDays * DAY_MS
  const mcpErrorCutoff = now - settings.mcpRelayErrorRetentionDays * DAY_MS
  const bodyCutoff = now - settings.bodyRetentionDays * DAY_MS

  const selectionStarted = performance.now()
  const evictRows = sqliteDb
    .prepare(
      `select id
       from requests
       where ${allowInference ? "(request_class = 'inference' and started_at < ?)" : '0'}
          or (request_class = 'mcp_relay' and status_code < 400 and error is null and started_at < ?)
          or (request_class = 'mcp_relay' and (status_code >= 400 or error is not null) and started_at < ?)
          or (started_at < ?
            and (request_headers is not null
              or request_body is not null
              or response_headers is not null
              or response_body is not null))`,
    )
    .all(...(allowInference ? [inferenceCutoff] : []), mcpSuccessCutoff, mcpErrorCutoff, bodyCutoff) as Array<{
    id: string
  }>
  const selectionMs = performance.now() - selectionStarted
  const inferenceDeleted = allowInference
    ? sqliteDb.transaction(() => {
        markPrunedBefore(sqliteDb, now, settings.requestLogRetentionDays)
        return sqliteDb
          .prepare("delete from requests where request_class = 'inference' and started_at < ?")
          .run(inferenceCutoff).changes
      })()
    : 0
  const mcpRelaySuccessDeleted = sqliteDb
    .prepare(
      "delete from requests where request_class = 'mcp_relay' and status_code < 400 and error is null and started_at < ?",
    )
    .run(mcpSuccessCutoff).changes
  const mcpRelayErrorDeleted = sqliteDb
    .prepare(
      "delete from requests where request_class = 'mcp_relay' and (status_code >= 400 or error is not null) and started_at < ?",
    )
    .run(mcpErrorCutoff).changes
  const bodiesCleared = sqliteDb
    .prepare(
      `update requests
       set request_headers = null,
           request_body = null,
           response_headers = null,
           response_body = null
       where started_at < ?
         and (request_headers is not null
           or request_body is not null
           or response_headers is not null
           or response_body is not null)`,
    )
    .run(bodyCutoff).changes

  for (const row of evictRows) deleteRecentBodies(row.id)

  return {
    result: { inferenceDeleted, mcpRelaySuccessDeleted, mcpRelayErrorDeleted, bodiesCleared },
    candidateRows: evictRows.length,
    selectionMs,
  }
}

export function compactDatabase(): { ok: true } {
  sqliteDb.pragma('wal_checkpoint(TRUNCATE)')
  sqliteDb.exec('VACUUM')
  return { ok: true }
}

function pruneRequestLogsSafely() {
  const started = performance.now()
  try {
    const { result, candidateRows, selectionMs } = pruneWithTiming(Date.now())
    console.info('[request-log-maintenance] prune complete', {
      durationMs: Math.round(performance.now() - started),
      selectionMs: Math.round(selectionMs),
      candidateRows,
      ...result,
    })
  } catch (err) {
    console.warn('Failed to prune request logs', err)
  }
}
