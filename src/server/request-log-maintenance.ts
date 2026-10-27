import { getPrivacySettings } from './admin/settings.ts'
import { sqliteDb } from './db/index.ts'
import { deleteRecentBodies } from './proxy/recent-bodies.ts'
import { markPrunedBefore, missingRollupDays, rebuildDailyStats, refreshDailyStats } from './usage-rollup.ts'

const DAY_MS = 24 * 60 * 60 * 1000
const MAINTENANCE_INTERVAL_MS = 60 * 60 * 1000

let started = false
let backfillComplete = false

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
    runMaintenance()
    setInterval(runMaintenance, MAINTENANCE_INTERVAL_MS).unref?.()
  }, 60_000).unref?.()
}

/** Refreshes recent daily usage rollups before deleting request rows. */
export function refreshUsageRollups(options: { now?: number; backfill?: boolean } = {}) {
  return refreshDailyStats(sqliteDb, {
    now: options.now,
    backfill: options.backfill,
    retentionDays: getPrivacySettings().requestLogRetentionDays,
  })
}

function scheduleBackfill() {
  setTimeout(() => {
    try {
      const days = missingRollupDays(sqliteDb, Date.now(), getPrivacySettings().requestLogRetentionDays)
      const next = () => {
        try {
          const day = days.shift()
          if (day) {
            rebuildDailyStats(sqliteDb, [day])
            setTimeout(next, 0).unref?.()
          } else {
            backfillComplete = true
          }
        } catch (err) {
          console.warn('Failed to backfill usage rollups; retrying', err)
          setTimeout(scheduleBackfill, 60_000).unref?.()
        }
      }
      next()
    } catch (err) {
      console.warn('Failed to backfill usage rollups; retrying', err)
      setTimeout(scheduleBackfill, 60_000).unref?.()
    }
  }, 0).unref?.()
}

export function prepareUsagePrune(now = Date.now()) {
  if (!backfillComplete) throw new Error('Usage backfill is not complete; pruning is paused')
  refreshUsageRollups({ now })
  markPrunedBefore(sqliteDb, now, getPrivacySettings().requestLogRetentionDays)
}

export function pruneRequestLogs(now = Date.now()): RequestLogPruneResult {
  return runRequestLogPrune(now).result
}

function runRequestLogPrune(now: number) {
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
       where (request_class = 'inference' and started_at < ?)
          or (request_class = 'mcp_relay' and status_code < 400 and error is null and started_at < ?)
          or (request_class = 'mcp_relay' and (status_code >= 400 or error is not null) and started_at < ?)
          or (started_at < ?
            and (request_headers is not null
              or request_body is not null
              or response_headers is not null
              or response_body is not null))`,
    )
    .all(inferenceCutoff, mcpSuccessCutoff, mcpErrorCutoff, bodyCutoff) as Array<{ id: string }>
  const selectionMs = performance.now() - selectionStarted
  const inferenceDeleted = sqliteDb
    .prepare("delete from requests where request_class = 'inference' and started_at < ?")
    .run(inferenceCutoff).changes
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
    const { result, candidateRows, selectionMs } = runRequestLogPrune(Date.now())
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

function runMaintenance() {
  try {
    prepareUsagePrune()
  } catch (err) {
    console.warn('Failed to prepare usage rollups; pruning skipped', err)
    return
  }
  pruneRequestLogsSafely()
}
