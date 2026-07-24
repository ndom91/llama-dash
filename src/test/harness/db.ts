import { invalidateKeyCache } from '../../server/admin/api-keys.ts'
import { invalidateModelAliasesCacheForTest } from '../../server/admin/model-aliases.ts'
import { invalidateRoutingRulesCacheForTest } from '../../server/admin/routing-rules.ts'
import { invalidateSettingsCacheForTest } from '../../server/admin/settings.ts'
import { db, schema, sqliteDb } from '../../server/db/index.ts'
import { runMigrations } from '../../server/db/migrate.ts'
import { flushRequestLogQueue, resetRequestLogQueueForTest } from '../../server/proxy/log.ts'
import { resetModelScheduler } from '../../server/proxy/model-scheduler.ts'

let migrated = false

const TABLE_NAMES = [
  'requests',
  'model_events',
  'api_keys',
  'model_aliases',
  'routing_rules',
  'upstream_credentials',
  'mcp_relays',
  'settings',
  'passkey',
  'session',
  'account',
  'verification',
  'user',
] as const

/** Apply pending Drizzle migrations once per integration process. */
export function ensureTestDatabase() {
  if (migrated) return
  runMigrations()
  migrated = true
}

/** Wipe app tables and clear in-memory caches between integration tests. */
export function resetTestDatabase() {
  ensureTestDatabase()
  flushRequestLogQueue()
  resetRequestLogQueueForTest()
  resetModelScheduler()

  sqliteDb.exec('PRAGMA foreign_keys = OFF')
  try {
    for (const table of TABLE_NAMES) {
      sqliteDb.prepare(`DELETE FROM ${table}`).run()
    }
  } finally {
    sqliteDb.exec('PRAGMA foreign_keys = ON')
  }

  invalidateKeyCache()
  invalidateRoutingRulesCacheForTest()
  invalidateSettingsCacheForTest()
  invalidateModelAliasesCacheForTest()
}

/** Flush the async request-log queue so SQLite assertions see written rows. */
export function flushLogs() {
  flushRequestLogQueue()
}

export function listLoggedRequests() {
  flushLogs()
  return db.select().from(schema.requests).all()
}

export { db, schema }
