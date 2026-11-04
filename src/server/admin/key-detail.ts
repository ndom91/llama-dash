import { and, desc, eq, gte, lt } from 'drizzle-orm'
import type { ApiKeyModelBreakdown, ApiKeyStats } from '../../lib/schemas/api-key.ts'
import type { ApiRequest } from '../../lib/schemas/request.ts'
import { db, schema } from '../db/index.ts'
import { requestSummaryColumns } from './request-summary-columns.ts'
import { summarizeRecentRequests, toRequestRow } from './requests.ts'

export function getKeyStats(keyId: string): ApiKeyStats {
  return summarizeRecentRequests(eq(schema.requests.keyId, keyId))
}

export function getKeyRequests(
  keyId: string,
  limit: number,
  cursor?: string,
): { rows: Array<ApiRequest>; nextCursor: string | null } {
  const conditions = [eq(schema.requests.keyId, keyId)]
  if (cursor) conditions.push(lt(schema.requests.id, cursor))

  const rows = db
    .select(requestSummaryColumns)
    .from(schema.requests)
    .where(and(...conditions))
    .orderBy(desc(schema.requests.id))
    .limit(limit)
    .all()
    .map((r) => toRequestRow(r, null))

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
