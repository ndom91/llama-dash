import { and, desc, eq, gte, inArray, like, lt, or } from 'drizzle-orm'
import type { ApiModel, ApiModelKeyBreakdown, ApiModelStats } from '../../lib/schemas/model'
import type { ApiRequest } from '../../lib/schemas/request'
import { db, schema } from '../db/index.ts'
import { inferenceBackend } from '../inference/backend.ts'
import type { BackendModel, BackendRunningModel } from '../inference/backend.ts'
import { getApiKeyName } from './api-keys.ts'
import { requestSummaryColumns } from './request-summary-columns.ts'
import { summarizeRecentRequests, toRequestRow } from './requests.ts'

function modelMatch(modelId: string) {
  const names = inferenceBackend.modelLogNames?.(modelId) ?? [modelId]
  return or(inArray(schema.requests.model, names), like(schema.requests.model, `%/${modelId}`))
}

export function getModelEvents(modelId: string, windowMs = 86_400_000) {
  const since = new Date(Date.now() - windowMs)
  return db
    .select()
    .from(schema.modelEvents)
    .where(and(eq(schema.modelEvents.modelId, modelId), gte(schema.modelEvents.timestamp, since)))
    .orderBy(desc(schema.modelEvents.timestamp))
    .all()
    .map((e) => ({
      id: e.id,
      modelId: e.modelId,
      event: e.event,
      timestamp: e.timestamp.toISOString(),
    }))
}

export function getModelRequestStats(modelId: string): ApiModelStats {
  return summarizeRecentRequests(modelMatch(modelId))
}

export function getModelRequests(
  modelId: string,
  limit: number,
  cursor?: string,
): { rows: Array<ApiRequest>; nextCursor: string | null } {
  const conditions = [modelMatch(modelId)]
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

export function getModelKeyBreakdown(modelId: string): Array<ApiModelKeyBreakdown> {
  const thirtyMinAgo = new Date(Date.now() - 30 * 60_000)

  const rows = db
    .select({
      keyId: schema.requests.keyId,
      statusCode: schema.requests.statusCode,
      totalTokens: schema.requests.totalTokens,
    })
    .from(schema.requests)
    .where(and(modelMatch(modelId), gte(schema.requests.startedAt, thirtyMinAgo)))
    .all()

  const byKey = new Map<string | null, { requestCount: number; totalTokens: number; errorCount: number }>()
  for (const r of rows) {
    const key = r.keyId ?? null
    const entry = byKey.get(key) ?? { requestCount: 0, totalTokens: 0, errorCount: 0 }
    entry.requestCount++
    entry.totalTokens += r.totalTokens ?? 0
    if (r.statusCode >= 400) entry.errorCount++
    byKey.set(key, entry)
  }

  return [...byKey.entries()]
    .map(([keyId, data]) => ({
      keyId,
      keyName: keyId ? getApiKeyName(keyId) : null,
      ...data,
    }))
    .sort((a, b) => b.requestCount - a.requestCount)
}

export function extractModelConfig(modelId: string): string | null {
  return inferenceBackend.modelConfigSnippet?.(modelId) ?? null
}

export function buildApiModel(
  model: BackendModel,
  running: BackendRunningModel | undefined,
  configContextLengths: Map<string, number>,
  peerHosts: Map<string, string> = new Map(),
): ApiModel {
  return {
    id: model.id,
    name: model.name,
    kind: model.kind,
    peerId: model.peerId,
    peerHost: model.peerId ? (peerHosts.get(model.peerId) ?? null) : null,
    selector: model.selector,
    contextLength:
      model.contextLength ??
      (model.kind === 'local' ? (running?.contextLength ?? configContextLengths.get(model.id) ?? null) : null),
    state: running?.state ?? (model.running ? 'ready' : 'stopped'),
    running: Boolean(running) || model.running,
    ttl: running?.ttl ?? null,
    capabilities: model.capabilities,
  }
}

export function getPeerHosts(): Map<string, string> {
  return inferenceBackend.peerHostHints?.() ?? new Map()
}

export function getConfigContextLengths(): Map<string, number> {
  return inferenceBackend.modelContextLengthHints?.() ?? new Map()
}
