import { readFileSync } from 'node:fs'
import { and, asc, desc, eq, gte, like, lt, or } from 'drizzle-orm'
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml'
import type { ApiModel, ApiModelKeyBreakdown, ApiModelStats } from '../../lib/schemas/model'
import type { ApiRequest } from '../../lib/schemas/request'
import { config } from '../config.ts'
import { db, schema } from '../db/index.ts'
import type { llamaSwap } from '../llama-swap/client.ts'

type LlamaSwapModel = Awaited<ReturnType<typeof llamaSwap.listModels>>['data'][number]
type LlamaSwapRunningModel = Awaited<ReturnType<typeof llamaSwap.listRunning>>['running'][number]

function modelMatch(modelId: string) {
  return or(eq(schema.requests.model, modelId), like(schema.requests.model, `%/${modelId}`))
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
    .where(and(modelMatch(modelId), gte(schema.requests.startedAt, thirtyMinAgo)))
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

export function getModelRequests(
  modelId: string,
  limit: number,
  cursor?: string,
): { rows: Array<ApiRequest>; nextCursor: string | null } {
  const conditions = [modelMatch(modelId)]
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
      cacheCreationTokens: r.cacheCreationTokens,
      cacheReadTokens: r.cacheReadTokens,
      costUsd: r.costUsd,
      streamed: r.streamed,
      error: r.error,
      keyName: null,
    }))

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

  const keyIds = [...byKey.keys()].filter((k): k is string => k != null)
  const keyNames = new Map<string, string>()
  if (keyIds.length > 0) {
    for (const k of db.select({ id: schema.apiKeys.id, name: schema.apiKeys.name }).from(schema.apiKeys).all()) {
      if (keyIds.includes(k.id)) keyNames.set(k.id, k.name)
    }
  }

  return [...byKey.entries()]
    .map(([keyId, data]) => ({
      keyId,
      keyName: keyId ? (keyNames.get(keyId) ?? null) : null,
      ...data,
    }))
    .sort((a, b) => b.requestCount - a.requestCount)
}

export function extractModelConfig(modelId: string): string | null {
  if (!config.llamaSwapConfigFile) return null
  try {
    const content = readFileSync(config.llamaSwapConfigFile, 'utf-8')
    const parsed = parseYaml(content)
    if (!parsed?.models?.[modelId]) return null
    return stringifyYaml({ [modelId]: parsed.models[modelId] }, { indent: 2 })
  } catch {
    return null
  }
}

function pickModelContextLength(model: LlamaSwapModel): number | null {
  return (
    model.context_length ??
    model.contextLength ??
    model.n_ctx ??
    model.meta?.context_length ??
    model.meta?.contextLength ??
    model.meta?.n_ctx ??
    model.meta?.llamaswap?.context_length ??
    model.meta?.llamaswap?.contextLength ??
    model.meta?.llamaswap?.n_ctx ??
    null
  )
}

function pickRunningContextLength(running: LlamaSwapRunningModel | undefined): number | null {
  if (!running?.cmd) return null
  const match = running.cmd.match(/--ctx-size\s+(\d+)/)
  return match ? Number(match[1]) : null
}

export function buildApiModel(
  model: LlamaSwapModel,
  running: LlamaSwapRunningModel | undefined,
  configContextLengths: Map<string, number>,
): ApiModel {
  const peerId = model.meta?.llamaswap?.peerID

  return {
    id: model.id,
    name: model.name ?? model.id,
    kind: peerId ? 'peer' : 'local',
    peerId: peerId ?? null,
    contextLength:
      pickModelContextLength(model) ??
      (peerId ? null : (pickRunningContextLength(running) ?? configContextLengths.get(model.id) ?? null)),
    state: running?.state ?? 'stopped',
    running: Boolean(running),
    ttl: running?.ttl ?? null,
  }
}

function extractCtxSize(value: unknown): number | null {
  const snippet = stringifyYaml(value, { indent: 2 })
  const match = snippet.match(/--ctx-size\s+(\d+)/)
  return match ? Number(match[1]) : null
}

export function getConfigContextLengths(): Map<string, number> {
  if (!config.llamaSwapConfigFile) return new Map()
  try {
    const content = readFileSync(config.llamaSwapConfigFile, 'utf-8')
    const parsed = parseYaml(content)
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      !('models' in parsed) ||
      !parsed.models ||
      typeof parsed.models !== 'object'
    ) {
      return new Map()
    }

    const lengths = new Map<string, number>()
    for (const [modelId, modelConfig] of Object.entries(parsed.models as Record<string, unknown>)) {
      const ctxSize = extractCtxSize(modelConfig)
      if (ctxSize != null) lengths.set(modelId, ctxSize)
    }
    return lengths
  } catch {
    return new Map()
  }
}
