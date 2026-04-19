import { and, asc, desc, eq, gte, lt } from 'drizzle-orm'
import type { ApiKeyModelBreakdown, ApiKeyStats } from '../../lib/schemas/api-key.ts'
import type { ApiRequest } from '../../lib/schemas/request.ts'
import { db, schema } from '../db/index.ts'

export function getKeyStats(keyId: string): ApiKeyStats {
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
    .where(and(eq(schema.requests.keyId, keyId), gte(schema.requests.startedAt, thirtyMinAgo)))
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

export function getKeyRequests(
  keyId: string,
  limit: number,
  cursor?: string,
): { rows: Array<ApiRequest>; nextCursor: string | null } {
  const conditions = [eq(schema.requests.keyId, keyId)]
  if (cursor) conditions.push(lt(schema.requests.id, cursor))

  const rows = db
    .select()
    .from(schema.requests)
    .where(and(...conditions))
    .orderBy(desc(schema.requests.id))
    .limit(limit)
    .all()
    .map((r) => ({
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
      streamed: r.streamed,
      error: r.error,
      keyName: null,
    }))

  return {
    rows,
    nextCursor: rows.length === limit ? rows[rows.length - 1].id : null,
  }
}

export function getKeyModelBreakdown(keyId: string): Array<ApiKeyModelBreakdown> {
  const thirtyMinAgo = new Date(Date.now() - 30 * 60_000)

  const rows = db
    .select({
      model: schema.requests.model,
      statusCode: schema.requests.statusCode,
      totalTokens: schema.requests.totalTokens,
    })
    .from(schema.requests)
    .where(and(eq(schema.requests.keyId, keyId), gte(schema.requests.startedAt, thirtyMinAgo)))
    .all()

  const byModel = new Map<string | null, { requestCount: number; totalTokens: number; errorCount: number }>()
  for (const r of rows) {
    const raw = r.model ?? null
    const model = raw?.includes('/') ? raw.split('/').pop()! : raw
    const entry = byModel.get(model) ?? { requestCount: 0, totalTokens: 0, errorCount: 0 }
    entry.requestCount++
    entry.totalTokens += r.totalTokens ?? 0
    if (r.statusCode >= 400) entry.errorCount++
    byModel.set(model, entry)
  }

  return [...byModel.entries()]
    .map(([model, data]) => ({ model, ...data }))
    .sort((a, b) => b.requestCount - a.requestCount)
}
