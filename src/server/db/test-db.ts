import { resolve } from 'node:path'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { backfillDay, backfillDays, finishBackfill } from '../usage-rollup'

/** Test-only: a fresh in-memory SQLite database with every checked-in migration applied. */
export function createMigratedTestDb(): Database.Database {
  const sqlite = new Database(':memory:')
  migrate(drizzle(sqlite), { migrationsFolder: resolve(process.cwd(), 'drizzle') })
  return sqlite
}

export function backfillTestUsage(sqlite: Database.Database, now: number, retentionDays: number) {
  for (const day of backfillDays(sqlite, now, retentionDays)) backfillDay(sqlite, day, now)
  finishBackfill(sqlite, now)
}

export type TestRequestRow = {
  id: string
  startedAt: number
  durationMs?: number
  requestClass?: 'inference' | 'mcp_relay'
  model?: string | null
  routedModel?: string | null
  statusCode?: number
  promptTokens?: number | null
  completionTokens?: number | null
  totalTokens?: number | null
  costUsd?: number | null
  streamed?: boolean
  error?: string | null
  keyId?: string | null
  clientName?: string | null
  clientHost?: string | null
  endUserId?: string | null
  sessionId?: string | null
  routingActionType?: string | null
}

/** Test-only: insert minimal `requests` rows. */
export function insertTestRequests(sqlite: Database.Database, rows: ReadonlyArray<TestRequestRow>) {
  const stmt = sqlite.prepare(
    `insert into requests (
      id, started_at, duration_ms, request_class, method, endpoint, model, status_code,
      prompt_tokens, completion_tokens, total_tokens, cost_usd, streamed, error, key_id,
      client_name, routing_routed_model, client_host, end_user_id, session_id, routing_action_type
    ) values (?, ?, ?, ?, 'POST', '/v1/chat/completions', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
  for (const row of rows) {
    const prompt = row.promptTokens === undefined ? 10 : row.promptTokens
    const completion = row.completionTokens === undefined ? 20 : row.completionTokens
    stmt.run(
      row.id,
      row.startedAt,
      row.durationMs ?? 1000,
      row.requestClass ?? 'inference',
      row.model === undefined ? 'model-a' : row.model,
      row.statusCode ?? 200,
      prompt,
      completion,
      row.totalTokens === undefined ? (prompt ?? 0) + (completion ?? 0) : row.totalTokens,
      row.costUsd ?? null,
      row.streamed === false ? 0 : 1,
      row.error ?? null,
      row.keyId ?? null,
      row.clientName ?? null,
      row.routedModel ?? null,
      row.clientHost ?? null,
      row.endUserId ?? null,
      row.sessionId ?? null,
      row.routingActionType ?? null,
    )
  }
}
