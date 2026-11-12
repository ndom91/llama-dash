import { and, asc, desc, eq, getTableColumns, gt, gte, inArray, lt, or, type SQL } from 'drizzle-orm'
import type { ApiKeyStats } from '../../lib/schemas/api-key.ts'
import type { ApiHistogramBucket, ApiRequest, ApiRequestStats } from '../../lib/schemas/request'
import { db, schema, sqliteDb } from '../db/index.ts'
import { getRecentBodies } from '../proxy/recent-bodies.ts'
import { getApiKeyName, getApiKeyNameMap } from './api-keys.ts'
import { requestSummaryColumns } from './request-summary-columns.ts'

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

export function toRequestRow(row: RequestSummarySource, keyName: string | null): ApiRequest {
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

// Last-30-minute totals and per-minute sparklines for the requests matching `where`.
export function summarizeRecentRequests(where: SQL | undefined): ApiKeyStats {
  const now = Date.now()
  const thirtyMinAgo = new Date(now - 30 * 60_000)

  const recent = db
    .select({
      startedAt: schema.requests.startedAt,
      durationMs: schema.requests.durationMs,
      statusCode: schema.requests.statusCode,
      totalTokens: schema.requests.totalTokens,
      completionTokens: schema.requests.completionTokens,
    })
    .from(schema.requests)
    .where(and(where, gte(schema.requests.startedAt, thirtyMinAgo)))
    .orderBy(asc(schema.requests.startedAt))
    .all()

  const totalRequests = recent.length
  const errorCount = recent.filter((r) => r.statusCode >= 400).length
  const errorRate = totalRequests > 0 ? (errorCount / totalRequests) * 100 : 0

  const durations = recent.map((r) => r.durationMs)
  const avgDurationMs = durations.length > 0 ? Math.round(durations.reduce((s, d) => s + d, 0) / durations.length) : 0

  const tokRates = recent
    .filter((r) => r.completionTokens != null && r.durationMs > 0)
    .map((r) => (r.completionTokens! / r.durationMs) * 1000)
  const avgTokPerSec = tokRates.length > 0 ? Math.round(tokRates.reduce((s, t) => s + t, 0) / tokRates.length) : 0

  const totalPromptTokens = recent.reduce((s, r) => s + (r.totalTokens ?? 0) - (r.completionTokens ?? 0), 0)
  const totalCompletionTokens = recent.reduce((s, r) => s + (r.completionTokens ?? 0), 0)

  const startBucket = Math.floor(thirtyMinAgo.getTime() / 60_000)
  const endBucket = Math.floor(now / 60_000)
  const count = endBucket - startBucket + 1
  const reqs = new Array<number>(count).fill(0)
  const toks = new Array<number>(count).fill(0)

  for (const r of recent) {
    const idx = Math.floor(r.startedAt.getTime() / 60_000) - startBucket
    if (idx >= 0 && idx < count) {
      reqs[idx]++
      toks[idx] += r.totalTokens ?? 0
    }
  }

  return {
    totalRequests,
    errorCount,
    errorRate,
    avgDurationMs,
    avgTokPerSec,
    totalPromptTokens,
    totalCompletionTokens,
    sparklines: { reqs, toks },
  }
}

export function listRecentRequests(opts: {
  limit: number
  cursor?: string
  includeMcp?: boolean
  minutes?: number[]
  status?: 'ok' | 'err'
}): Array<ApiRequest> {
  const where = and(
    opts.cursor != null ? lt(schema.requests.id, opts.cursor) : undefined,
    opts.includeMcp ? undefined : inferenceRequest(),
    opts.status === 'err'
      ? gte(schema.requests.statusCode, 400)
      : opts.status === 'ok'
        ? and(gte(schema.requests.statusCode, 200), lt(schema.requests.statusCode, 400))
        : undefined,
    opts.minutes?.length
      ? or(
          ...opts.minutes.map((minute) =>
            and(
              gte(schema.requests.startedAt, new Date(minute)),
              lt(schema.requests.startedAt, new Date(minute + 60_000)),
            ),
          ),
        )
      : undefined,
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

export function countRecentMcpRequests(opts: { cursor?: string; minutes?: number[]; status?: 'ok' | 'err' }): number {
  const row = sqliteDb
    .prepare(
      `select count(*) as count
       from requests
         where request_class = 'mcp_relay'
        ${opts.status === 'err' ? 'and status_code >= 400' : opts.status === 'ok' ? 'and status_code >= 200 and status_code < 400' : ''}
        ${opts.cursor ? 'and id < ?' : ''}
        ${opts.minutes?.length ? `and (${opts.minutes.map(() => '(started_at >= ? and started_at < ?)').join(' or ')})` : ''}`,
    )
    .get(
      ...(opts.cursor ? [opts.cursor] : []),
      ...(opts.minutes?.flatMap((minute) => [minute, minute + 60_000]) ?? []),
    ) as {
    count: number
  }
  return row.count
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
    firstOutputMs: row.firstOutputMs,
    outputSpanMs: row.outputSpanMs,
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

// Older rows can still be associated when their captured headers survived retention.
export function listRequestSession(id: string, cursor?: string, order: 'asc' | 'desc' = 'asc', limit = 20) {
  const anchor = db
    .select({ sessionId: schema.requests.sessionId, headers: schema.requests.requestHeaders })
    .from(schema.requests)
    .where(eq(schema.requests.id, id))
    .get()
  if (!anchor) return null
  let sessionId = anchor.sessionId
  if (!sessionId && anchor.headers) {
    try {
      const headers = JSON.parse(anchor.headers) as Record<string, unknown>
      const value = headers['x-claude-code-session-id'] ?? headers['session-id']
      if (typeof value === 'string') sessionId = value.trim() || null
    } catch {}
  }
  if (!sessionId) return { sessionId: null, requests: [], nextCursor: null }
  // The log ID is assigned on completion, so order by request start time and
  // use ID only as a tie-breaker. The cursor carries both values so it remains
  // usable if the boundary request is pruned between pages.
  let cursorTime: number | undefined
  let cursorId: string | undefined
  if (cursor) {
    const match = /^(\d+):([a-zA-Z0-9_]+)$/.exec(cursor)
    if (match) {
      cursorTime = Number(match[1])
      cursorId = match[2]
    } else {
      // Accept cursors issued by the previous version while clients reload.
      const row = db
        .select({ startedAt: schema.requests.startedAt })
        .from(schema.requests)
        .where(eq(schema.requests.id, cursor))
        .get()
      if (!row) return { sessionId, requests: [], nextCursor: null, olderContext: null }
      cursorTime = row.startedAt.getTime()
      cursorId = cursor
    }
  }
  const cursorClause = cursorId ? `and (started_at, id) ${order === 'desc' ? '<' : '>'} (?, ?)` : ''
  const direction = order === 'desc' ? 'desc' : 'asc'
  const cursorArgs = cursorId ? [cursorTime!, cursorId] : []
  const current = sqliteDb
    .prepare(`select id, started_at as startedAt from requests indexed by idx_requests_session_started_id
    where session_id = ? and request_class = 'inference' ${cursorClause} order by started_at ${direction}, id ${direction} limit ?`)
    .all(sessionId, ...cursorArgs, limit + 1) as Array<{ id: string; startedAt: number }>
  const legacy = sqliteDb
    .prepare(`select id, started_at as startedAt from requests indexed by idx_requests_session_started_id
    where session_id is null and request_class = 'inference' ${cursorClause}
      and case when json_valid(request_headers) then
        (json_extract(request_headers, '$."x-claude-code-session-id"') = ?
          or json_extract(request_headers, '$."session-id"') = ?) else 0 end
    order by started_at ${direction}, id ${direction} limit ?`)
    .all(...cursorArgs, sessionId, sessionId, limit + 1) as Array<{ id: string; startedAt: number }>
  const entries = [...current, ...legacy].sort(
    (a, b) => a.startedAt - b.startedAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  )
  if (order === 'desc') entries.reverse()
  const ids = entries.map((entry) => entry.id)
  const page = ids.slice(0, limit)
  const contextId = order === 'desc' ? ids[limit] : undefined
  const fetchedIds = contextId ? [...page, contextId] : page
  const rows =
    fetchedIds.length === 0
      ? []
      : db
          .select({
            ...requestSummaryColumns,
            keyId: schema.requests.keyId,
            requestBody: schema.requests.requestBody,
            responseBody: schema.requests.responseBody,
            requestHeaders: schema.requests.requestHeaders,
          })
          .from(schema.requests)
          .where(inArray(schema.requests.id, fetchedIds))
          .all()
  const rowMap = new Map(rows.map((row) => [row.id, row]))
  const keyMap = getApiKeyNameMap()
  return {
    sessionId,
    requests: page.map((id) => {
      const row = rowMap.get(id)!
      const recent = getRecentBodies(id)
      let clientUserAgent: string | null = null
      if (row.requestHeaders) {
        try {
          const headers = JSON.parse(row.requestHeaders) as Record<string, unknown>
          if (typeof headers['user-agent'] === 'string') clientUserAgent = headers['user-agent'].slice(0, 256)
        } catch {}
      }
      return {
        ...toRequestRow(row, row.keyId ? (keyMap.get(row.keyId) ?? null) : null),
        clientUserAgent,
        payloads: {
          requestBody: recent?.requestBody ?? row.requestBody,
          responseBody: recent?.responseBody ?? row.responseBody,
        },
      }
    }),
    nextCursor: ids.length > limit ? `${entries[limit - 1].startedAt}:${entries[limit - 1].id}` : null,
    olderContext: contextId
      ? (() => {
          const row = rowMap.get(contextId)!
          const recent = getRecentBodies(contextId)
          return {
            id: row.id,
            statusCode: row.statusCode,
            model: row.model,
            streamed: row.streamed,
            promptTokens: row.promptTokens,
            endpoint: row.endpoint,
            cacheReadTokens: row.cacheReadTokens,
            cacheCreationTokens: row.cacheCreationTokens,
            payloads: {
              requestBody: recent?.requestBody ?? row.requestBody,
              responseBody: recent?.responseBody ?? row.responseBody,
            },
          }
        })()
      : null,
  }
}

type StatsCache = { at: number; value: ApiRequestStats }
let statsCache: StatsCache | null = null
const STATS_CACHE_MS = 1_000

export function getRequestStats(): ApiRequestStats {
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

export function getRequestHistogram(windowMs = 3_600_000, bucketMs = 60_000): Array<ApiHistogramBucket> {
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

  const result: Array<ApiHistogramBucket> = []
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
