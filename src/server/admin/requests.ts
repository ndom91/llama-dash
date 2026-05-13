import { and, asc, desc, eq, gte, gt, lt } from 'drizzle-orm'
import type { ApiHistogramBucket, ApiRequest, ApiRequestDetail, ApiRequestStats } from '../../lib/schemas/request'
import { db, schema, sqliteDb } from '../db/index.ts'
import { getRecentBodies } from '../proxy/recent-bodies.ts'
import { getApiKeyName, getApiKeyNameMap } from './api-keys.ts'

export type RequestRow = ApiRequest
export type RequestDetail = ApiRequestDetail

export function listRecentRequests(opts: { limit: number; cursor?: string }): Array<RequestRow> {
  const where = opts.cursor != null ? lt(schema.requests.id, opts.cursor) : undefined
  const rows = db
    .select()
    .from(schema.requests)
    .where(and(where))
    .orderBy(desc(schema.requests.id))
    .limit(opts.limit)
    .all()

  const keyMap = getApiKeyNameMap()

  return rows.map((r) => ({
    id: r.id,
    startedAt: r.startedAt.toISOString(),
    durationMs: r.durationMs,
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
    keyName: r.keyId ? (keyMap.get(r.keyId) ?? null) : null,
    clientHost: r.clientHost,
    clientName: r.clientName,
    endUserId: r.endUserId,
    sessionId: r.sessionId,
    routingRuleName: r.routingRuleName,
    routingActionType: r.routingActionType,
    routingAuthMode: r.routingAuthMode,
    routingPreserveAuthorization: r.routingPreserveAuthorization,
    routingTargetType: r.routingTargetType,
    routingTargetBaseUrl: r.routingTargetBaseUrl,
    routingTargetCredentialId: r.routingTargetCredentialId,
    routingRoutedModel: r.routingRoutedModel,
  }))
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
  const since = new Date(now - windowMs)

  const rows = db
    .select({
      startedAt: schema.requests.startedAt,
      statusCode: schema.requests.statusCode,
    })
    .from(schema.requests)
    .where(gte(schema.requests.startedAt, since))
    .orderBy(asc(schema.requests.startedAt))
    .all()

  const startBucket = Math.floor(since.getTime() / bucketMs)
  const endBucket = Math.floor(now / bucketMs)
  const count = endBucket - startBucket + 1
  const totals = new Array<number>(count).fill(0)
  const errors = new Array<number>(count).fill(0)

  for (const r of rows) {
    const idx = Math.floor(r.startedAt.getTime() / bucketMs) - startBucket
    if (idx >= 0 && idx < count) {
      totals[idx]++
      if (r.statusCode >= 400) errors[idx]++
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
    .where(gt(schema.requests.id, id))
    .orderBy(asc(schema.requests.id))
    .limit(1)
    .get()
  const next = db
    .select({ id: schema.requests.id })
    .from(schema.requests)
    .where(lt(schema.requests.id, id))
    .orderBy(desc(schema.requests.id))
    .limit(1)
    .get()
  return { prevId: prev?.id ?? null, nextId: next?.id ?? null }
}
