import { and, asc, desc, eq, gte, gt, lt } from 'drizzle-orm'
import type { ApiHistogramBucket, ApiRequest, ApiRequestDetail, ApiRequestStats } from '../../lib/schemas/request'
import { db, schema } from '../db/index.ts'
import { getRecentBodies } from '../proxy/recent-bodies.ts'
import { listApiKeys } from './api-keys.ts'

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

  const keys = listApiKeys()
  const keyMap = new Map(keys.map((k) => [k.id, k.name]))

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
    routingRuleName: r.routingRuleName,
    routingActionType: r.routingActionType,
    routingRoutedModel: r.routingRoutedModel,
  }))
}

export function getRequestById(id: string): RequestDetail | null {
  const r = db.select().from(schema.requests).where(eq(schema.requests.id, id)).get()
  if (!r) return null

  let keyName: string | null = null
  if (r.keyId) {
    const keys = listApiKeys()
    keyName = keys.find((k) => k.id === r.keyId)?.name ?? null
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
    routingRuleId: r.routingRuleId,
    routingRuleName: r.routingRuleName,
    routingActionType: r.routingActionType,
    routingRequestedModel: r.routingRequestedModel,
    routingRoutedModel: r.routingRoutedModel,
    routingRejectReason: r.routingRejectReason,
  }
}

export type RequestStats = ApiRequestStats

export function getRequestStats(): RequestStats {
  const now = Date.now()
  const thirtyMinAgo = new Date(now - 30 * 60_000)
  const oneMinAgo = now - 60_000

  const recent = db
    .select({
      startedAt: schema.requests.startedAt,
      durationMs: schema.requests.durationMs,
      statusCode: schema.requests.statusCode,
      totalTokens: schema.requests.totalTokens,
    })
    .from(schema.requests)
    .where(gte(schema.requests.startedAt, thirtyMinAgo))
    .orderBy(asc(schema.requests.startedAt))
    .all()

  const lastMinute = recent.filter((r) => r.startedAt.getTime() >= oneMinAgo)
  const reqPerSec = lastMinute.length / 60
  const tokPerSec = lastMinute.reduce((s, r) => s + (r.totalTokens ?? 0), 0) / 60

  const sorted = recent.map((r) => r.durationMs).sort((a, b) => a - b)
  const p50Latency = sorted.length > 0 ? sorted[Math.floor(sorted.length / 2)] : 0

  const errCount = recent.filter((r) => r.statusCode >= 400).length
  const errorRate = recent.length > 0 ? (errCount / recent.length) * 100 : 0

  const startBucket = Math.floor(thirtyMinAgo.getTime() / 60_000)
  const endBucket = Math.floor(now / 60_000)
  const count = endBucket - startBucket + 1

  const reqs = new Array<number>(count).fill(0)
  const toks = new Array<number>(count).fill(0)
  const latBuckets: Array<Array<number>> = Array.from({ length: count }, () => [])
  const errs = new Array<number>(count).fill(0)
  const totals = new Array<number>(count).fill(0)

  for (const r of recent) {
    const idx = Math.floor(r.startedAt.getTime() / 60_000) - startBucket
    if (idx >= 0 && idx < count) {
      reqs[idx]++
      toks[idx] += r.totalTokens ?? 0
      latBuckets[idx].push(r.durationMs)
      totals[idx]++
      if (r.statusCode >= 400) errs[idx]++
    }
  }

  return {
    reqPerSec,
    tokPerSec,
    p50Latency,
    errorRate,
    sparklines: {
      reqs,
      toks,
      latency: latBuckets.map((arr) => (arr.length > 0 ? arr.reduce((s, v) => s + v, 0) / arr.length : 0)),
      errors: errs.map((e, i) => (totals[i] > 0 ? (e / totals[i]) * 100 : 0)),
    },
  }
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
