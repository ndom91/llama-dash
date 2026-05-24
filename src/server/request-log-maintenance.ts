import { getPrivacySettings } from './admin/settings.ts'
import { sqliteDb } from './db/index.ts'
import { deleteRecentBodies } from './proxy/recent-bodies.ts'

const DAY_MS = 24 * 60 * 60 * 1000
const MAINTENANCE_INTERVAL_MS = 60 * 60 * 1000

let started = false

export type RequestLogPruneResult = {
  inferenceDeleted: number
  mcpRelaySuccessDeleted: number
  mcpRelayErrorDeleted: number
  bodiesCleared: number
}

export function startRequestLogMaintenance() {
  if (started) return
  started = true
  setTimeout(() => {
    pruneRequestLogsSafely()
    setInterval(pruneRequestLogsSafely, MAINTENANCE_INTERVAL_MS).unref?.()
  }, 60_000).unref?.()
}

export function pruneRequestLogs(now = Date.now()): RequestLogPruneResult {
  const settings = getPrivacySettings()
  const inferenceCutoff = now - settings.requestLogRetentionDays * DAY_MS
  const mcpSuccessCutoff = now - settings.mcpRelaySuccessRetentionDays * DAY_MS
  const mcpErrorCutoff = now - settings.mcpRelayErrorRetentionDays * DAY_MS
  const bodyCutoff = now - settings.bodyRetentionDays * DAY_MS

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

  return { inferenceDeleted, mcpRelaySuccessDeleted, mcpRelayErrorDeleted, bodiesCleared }
}

export function compactDatabase(): { ok: true } {
  sqliteDb.pragma('wal_checkpoint(TRUNCATE)')
  sqliteDb.exec('VACUUM')
  return { ok: true }
}

function pruneRequestLogsSafely() {
  try {
    pruneRequestLogs()
  } catch (err) {
    console.warn('Failed to prune request logs', err)
  }
}
