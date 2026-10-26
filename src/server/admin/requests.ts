import { and, asc, desc, eq, gt, lt, getTableColumns } from 'drizzle-orm'
import type { ApiHistogramBucket, ApiRequest, ApiRequestDetail, ApiRequestStats } from '../../lib/schemas/request'
import { db, schema, sqliteDb } from '../db/index.ts'
import { getRecentBodies } from '../proxy/recent-bodies.ts'
import { getApiKeyName, getApiKeyNameMap } from './api-keys.ts'
import { requestSummaryColumns } from './request-summary-columns.ts'

export type RequestRow = ApiRequest
export type RequestDetail = ApiRequestDetail

const INFERENCE_REQUEST_SQL = "request_class = 'inference'"

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

function inferenceRequest() {
  return eq(schema.requests.requestClass, 'inference')
}

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
    opts.includeMcp ? undefined : inferenceRequest(),
  )
  const rows = db
    .select({
      ...requestSummaryColumns,
      keyId: schema.requests.keyId,
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
  return {
    ...toRequestMetadata(r, r.keyId ? getApiKeyName(r.keyId) : null),
    ...toRequestPayloads(r, getRecentBodies(id)),
  }
}

type RequestMetadataSource = Omit<
  typeof schema.requests.$inferSelect,
  'requestBody' | 'responseBody' | 'requestHeaders' | 'responseHeaders'
>

function toRequestMetadata(row: RequestMetadataSource, keyName: string | null) {
  return {
    ...toRequestRow(row, keyName),
    streamCloseMs: row.streamCloseMs,
    prefillMs: row.prefillMs,
    decodeMs: row.decodeMs,
    routingRuleId: row.routingRuleId,
    routingRequestedModel: row.routingRequestedModel,
    routingRejectReason: row.routingRejectReason,
  }
}

function toRequestPayloads(
  row: Pick<typeof schema.requests.$inferSelect, 'requestBody' | 'responseBody' | 'requestHeaders' | 'responseHeaders'>,
  recent: ReturnType<typeof getRecentBodies>,
) {
  return {
    requestHeaders: row.requestHeaders,
    responseHeaders: row.responseHeaders,
    requestBody: recent?.requestBody ?? row.requestBody,
    responseBody: recent?.responseBody ?? row.responseBody,
  }
}

export function getRequestMetadataById(id: string) {
  const {
    requestBody: _requestBody,
    responseBody: _responseBody,
    requestHeaders: _requestHeaders,
    responseHeaders: _responseHeaders,
    ...columns
  } = getTableColumns(schema.requests)
  const row = db.select(columns).from(schema.requests).where(eq(schema.requests.id, id)).get()
  if (!row) return null
  return toRequestMetadata(row, row.keyId ? getApiKeyName(row.keyId) : null)
}

export function getRequestPayloadsById(id: string) {
  const row = db
    .select({
      requestHeaders: schema.requests.requestHeaders,
      requestBody: schema.requests.requestBody,
      responseHeaders: schema.requests.responseHeaders,
      responseBody: schema.requests.responseBody,
    })
    .from(schema.requests)
    .where(eq(schema.requests.id, id))
    .get()
  if (!row) return null
  return toRequestPayloads(row, getRecentBodies(id))
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
      where ${INFERENCE_REQUEST_SQL} and started_at >= ?`,
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
      `select duration_ms as durationMs
       from requests
       where ${INFERENCE_REQUEST_SQL} and started_at >= ?
       order by duration_ms
       limit 1 offset ?`,
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
      where ${INFERENCE_REQUEST_SQL} and started_at >= ?
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
      where ${INFERENCE_REQUEST_SQL} and started_at >= ?
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
    .where(and(gt(schema.requests.id, id), inferenceRequest()))
    .orderBy(asc(schema.requests.id))
    .limit(1)
    .get()
  const next = db
    .select({ id: schema.requests.id })
    .from(schema.requests)
    .where(and(lt(schema.requests.id, id), inferenceRequest()))
    .orderBy(desc(schema.requests.id))
    .limit(1)
    .get()
  return { prevId: prev?.id ?? null, nextId: next?.id ?? null }
}
