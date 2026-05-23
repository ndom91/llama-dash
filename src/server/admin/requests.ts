import { and, asc, desc, eq, gt, lt, ne } from 'drizzle-orm'
import type { ApiHistogramBucket, ApiRequest, ApiRequestDetail, ApiRequestStats } from '../../lib/schemas/request'
import { db, schema, sqliteDb } from '../db/index.ts'
import { getRecentBodies } from '../proxy/recent-bodies.ts'
import { getApiKeyName, getApiKeyNameMap } from './api-keys.ts'

export type RequestRow = ApiRequest
export type RequestDetail = ApiRequestDetail

type RequestSummarySource = Pick<
  typeof schema.requests.$inferSelect,
  | 'id'
  | 'startedAt'
  | 'durationMs'
  | 'requestClass'
  | 'method'
  | 'endpoint'
  | 'model'
  | 'statusCode'
  | 'promptTokens'
  | 'completionTokens'
  | 'totalTokens'
  | 'cacheCreationTokens'
  | 'cacheReadTokens'
  | 'costUsd'
  | 'streamed'
  | 'error'
  | 'clientHost'
  | 'clientName'
  | 'endUserId'
  | 'sessionId'
  | 'routingRuleName'
  | 'routingActionType'
  | 'routingAuthMode'
  | 'routingPreserveAuthorization'
  | 'routingTargetType'
  | 'routingTargetBaseUrl'
  | 'routingTargetCredentialId'
  | 'routingRoutedModel'
  | 'credentialInjectionJson'
>

export function toRequestRow(row: RequestSummarySource, keyName: string | null): RequestRow {
  return {
    id: row.id,
    startedAt: row.startedAt.toISOString(),
    durationMs: row.durationMs,
    requestClass: row.requestClass,
    method: row.method,
    endpoint: row.endpoint,
    model: row.model,
    statusCode: row.statusCode,
    promptTokens: row.promptTokens,
    completionTokens: row.completionTokens,
    totalTokens: row.totalTokens,
    cacheCreationTokens: row.cacheCreationTokens,
    cacheReadTokens: row.cacheReadTokens,
    costUsd: row.costUsd,
    streamed: row.streamed,
    error: row.error,
    keyName,
    clientHost: row.clientHost,
    clientName: row.clientName,
    endUserId: row.endUserId,
    sessionId: row.sessionId,
    routingRuleName: row.routingRuleName,
    routingActionType: row.routingActionType,
    routingAuthMode: row.routingAuthMode,
    routingPreserveAuthorization: row.routingPreserveAuthorization,
    routingTargetType: row.routingTargetType,
    routingTargetBaseUrl: row.routingTargetBaseUrl,
    routingTargetCredentialId: row.routingTargetCredentialId,
    routingRoutedModel: row.routingRoutedModel,
    credentialInjectionJson: row.credentialInjectionJson,
  }
}

export function listRecentRequests(opts: { limit: number; cursor?: string; includeMcp?: boolean }): Array<RequestRow> {
  const where = and(
    opts.cursor != null ? lt(schema.requests.id, opts.cursor) : undefined,
    opts.includeMcp ? undefined : ne(schema.requests.requestClass, 'mcp_relay'),
  )
  const rows = db
    .select({
      id: schema.requests.id,
      startedAt: schema.requests.startedAt,
      durationMs: schema.requests.durationMs,
      requestClass: schema.requests.requestClass,
      method: schema.requests.method,
      endpoint: schema.requests.endpoint,
      model: schema.requests.model,
      statusCode: schema.requests.statusCode,
      promptTokens: schema.requests.promptTokens,
      completionTokens: schema.requests.completionTokens,
      totalTokens: schema.requests.totalTokens,
      cacheCreationTokens: schema.requests.cacheCreationTokens,
      cacheReadTokens: schema.requests.cacheReadTokens,
      costUsd: schema.requests.costUsd,
      streamed: schema.requests.streamed,
      error: schema.requests.error,
      keyId: schema.requests.keyId,
      clientHost: schema.requests.clientHost,
      clientName: schema.requests.clientName,
      endUserId: schema.requests.endUserId,
      sessionId: schema.requests.sessionId,
      routingRuleName: schema.requests.routingRuleName,
      routingActionType: schema.requests.routingActionType,
      routingAuthMode: schema.requests.routingAuthMode,
      routingPreserveAuthorization: schema.requests.routingPreserveAuthorization,
      routingTargetType: schema.requests.routingTargetType,
      routingTargetBaseUrl: schema.requests.routingTargetBaseUrl,
      routingTargetCredentialId: schema.requests.routingTargetCredentialId,
      routingRoutedModel: schema.requests.routingRoutedModel,
      credentialInjectionJson: schema.requests.credentialInjectionJson,
    })
    .from(schema.requests)
    .where(where)
    .orderBy(desc(schema.requests.id))
    .limit(opts.limit)
    .all()

  const keyMap = getApiKeyNameMap()

  return rows.map((r) => toRequestRow(r, r.keyId ? (keyMap.get(r.keyId) ?? null) : null))
}

export function countRecentMcpRequests(opts: { cursor?: string }): number {
  const row = sqliteDb
    .prepare(
      `select count(*) as count
       from requests
       where request_class = 'mcp_relay'
       ${opts.cursor ? 'and id < ?' : ''}`,
    )
    .get(...(opts.cursor ? [opts.cursor] : [])) as {
    count: number
  }
  return row.count
}

export function getRequestById(id: string): RequestDetail | null {
  const r = db.select().from(schema.requests).where(eq(schema.requests.id, id)).get()
  if (!r) return null

  let keyName: string | null = null
  if (r.keyId) {
    keyName = getApiKeyName(r.keyId)
  }

  // Fall back to the in-memory ring buffer for full bodies when the request
  // is recent enough to still be cached (DB holds a truncated copy).
  const recent = getRecentBodies(r.id)
  return {
    id: r.id,
    startedAt: r.startedAt.toISOString(),
    durationMs: r.durationMs,
    requestClass: r.requestClass,
    method: r.method,
    endpoint: r.endpoint,
    model: r.model,
    statusCode: r.statusCode,
    promptTokens: r.promptTokens,
    completionTokens: r.completionTokens,
    totalTokens: r.totalTokens,
    cacheCreationTokens: r.cacheCreationTokens,
    cacheReadTokens: r.cacheReadTokens,
    costUsd: r.costUsd,
    streamed: r.streamed,
    error: r.error,
    keyName,
    requestHeaders: r.requestHeaders,
    requestBody: recent?.requestBody ?? r.requestBody,
    responseHeaders: r.responseHeaders,
    responseBody: recent?.responseBody ?? r.responseBody,
    streamCloseMs: r.streamCloseMs,
    clientHost: r.clientHost,
    clientName: r.clientName,
    endUserId: r.endUserId,
    sessionId: r.sessionId,
    routingRuleId: r.routingRuleId,
    routingRuleName: r.routingRuleName,
    routingActionType: r.routingActionType,
    routingAuthMode: r.routingAuthMode,
    routingPreserveAuthorization: r.routingPreserveAuthorization,
    routingTargetType: r.routingTargetType,
    routingTargetBaseUrl: r.routingTargetBaseUrl,
    routingTargetCredentialId: r.routingTargetCredentialId,
    routingRequestedModel: r.routingRequestedModel,
    routingRoutedModel: r.routingRoutedModel,
    routingRejectReason: r.routingRejectReason,
    credentialInjectionJson: r.credentialInjectionJson,
  }
}

export type RequestStats = ApiRequestStats

type StatsCache = { at: number; value: RequestStats }
let statsCache: StatsCache | null = null
const STATS_CACHE_MS = 1_000

export function getRequestStats(): RequestStats {
  const now = Date.now()
  if (statsCache && now - statsCache.at < STATS_CACHE_MS) return statsCache.value

  const thirtyMinAgoMs = now - 30 * 60_000
  const oneMinAgo = now - 60_000

  const summary = sqliteDb
    .prepare(
      `select
        count(*) as total,
        sum(case when status_code >= 400 then 1 else 0 end) as errors,
        sum(case when started_at >= ? then 1 else 0 end) as last_minute_total,
        sum(case when started_at >= ? then coalesce(total_tokens, 0) else 0 end) as last_minute_tokens
      from requests
      where started_at >= ?`,
    )
    .get(oneMinAgo, oneMinAgo, thirtyMinAgoMs) as {
    total: number
    errors: number | null
    last_minute_total: number | null
    last_minute_tokens: number | null
  }

  const medianOffset = Math.max(0, Math.floor((summary.total || 1) / 2))
  const median = sqliteDb
    .prepare(
      'select duration_ms as durationMs from requests where started_at >= ? order by duration_ms limit 1 offset ?',
    )
    .get(thirtyMinAgoMs, medianOffset) as { durationMs: number } | undefined

  const startBucket = Math.floor(thirtyMinAgoMs / 60_000)
  const endBucket = Math.floor(now / 60_000)
  const count = endBucket - startBucket + 1

  const rows = sqliteDb
    .prepare(
      `select
        cast(started_at / 60000 as integer) as bucket,
        count(*) as reqs,
        sum(coalesce(total_tokens, 0)) as toks,
        avg(duration_ms) as latency,
        sum(case when status_code >= 400 then 1 else 0 end) as errs
      from requests
      where started_at >= ?
      group by bucket
      order by bucket`,
    )
    .all(thirtyMinAgoMs) as Array<{
    bucket: number
    reqs: number
    toks: number | null
    latency: number | null
    errs: number | null
  }>

  const reqs = new Array<number>(count).fill(0)
  const toks = new Array<number>(count).fill(0)
  const latency = new Array<number>(count).fill(0)
  const errors = new Array<number>(count).fill(0)

  for (const row of rows) {
    const idx = row.bucket - startBucket
    if (idx < 0 || idx >= count) continue
    reqs[idx] = row.reqs
    toks[idx] = row.toks ?? 0
    latency[idx] = row.latency ?? 0
    errors[idx] = row.reqs > 0 ? ((row.errs ?? 0) / row.reqs) * 100 : 0
  }

  const value = {
    reqPerSec: (summary.last_minute_total ?? 0) / 60,
    tokPerSec: (summary.last_minute_tokens ?? 0) / 60,
    p50Latency: median?.durationMs ?? 0,
    errorRate: summary.total > 0 ? ((summary.errors ?? 0) / summary.total) * 100 : 0,
    sparklines: {
      reqs,
      toks,
      latency,
      errors,
    },
  }
  statsCache = { at: now, value }
  return value
}

export type HistogramBucket = ApiHistogramBucket

export function getRequestHistogram(windowMs = 3_600_000, bucketMs = 60_000): Array<HistogramBucket> {
  const now = Date.now()
  const sinceMs = now - windowMs

  const rows = sqliteDb
    .prepare(
      `select
        cast(started_at / ? as integer) as bucket,
        count(*) as total,
        sum(case when status_code >= 400 then 1 else 0 end) as errors
      from requests
      where started_at >= ?
      group by bucket
      order by bucket`,
    )
    .all(bucketMs, sinceMs) as Array<{ bucket: number; total: number; errors: number | null }>

  const startBucket = Math.floor(sinceMs / bucketMs)
  const endBucket = Math.floor(now / bucketMs)
  const count = endBucket - startBucket + 1
  const totals = new Array<number>(count).fill(0)
  const errors = new Array<number>(count).fill(0)

  for (const row of rows) {
    const idx = row.bucket - startBucket
    if (idx >= 0 && idx < count) {
      totals[idx] = row.total
      errors[idx] = row.errors ?? 0
    }
  }

  const result: Array<HistogramBucket> = []
  for (let i = 0; i < count; i++) {
    result.push({
      timestamp: (startBucket + i) * bucketMs,
      total: totals[i],
      errors: errors[i],
    })
  }
  return result
}

export function getAdjacentIds(id: string): { prevId: string | null; nextId: string | null } {
  const prev = db
    .select({ id: schema.requests.id })
    .from(schema.requests)
    .where(and(gt(schema.requests.id, id), ne(schema.requests.requestClass, 'mcp_relay')))
    .orderBy(asc(schema.requests.id))
    .limit(1)
    .get()
  const next = db
    .select({ id: schema.requests.id })
    .from(schema.requests)
    .where(and(lt(schema.requests.id, id), ne(schema.requests.requestClass, 'mcp_relay')))
    .orderBy(desc(schema.requests.id))
    .limit(1)
    .get()
  return { prevId: prev?.id ?? null, nextId: next?.id ?? null }
}
