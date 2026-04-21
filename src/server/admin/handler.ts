import * as v from 'valibot'
import { CreateApiKeyBodySchema, UpdateApiKeyBodySchema } from '../../lib/schemas/api-key.ts'
import { ConfigSaveBodySchema, ConfigValidateBodySchema } from '../../lib/schemas/config'
import { CreateModelAliasBodySchema, UpdateModelAliasBodySchema } from '../../lib/schemas/model-alias.ts'
import { UpdateRequestLimitsBodySchema } from '../../lib/schemas/settings.ts'
import { config } from '../config.ts'
import { getGpuSnapshot } from '../gpu-poller.ts'
import { llamaSwap } from '../llama-swap/client.ts'
import {
  createApiKey,
  deleteApiKey,
  getApiKeyById,
  getSystemKeyRaw,
  listApiKeys,
  revokeApiKey,
  updateApiKey,
} from './api-keys.ts'
import { getKeyModelBreakdown, getKeyRequests, getKeyStats } from './key-detail.ts'
import { readConfig, validateAgainstSchema, writeConfig } from './config.ts'
import { createModelAlias, deleteModelAlias, listModelAliases, updateModelAlias } from './model-aliases.ts'
import { getRequestLimits, setRequestLimits } from './settings.ts'
import {
  extractModelConfig,
  getConfigContextLengths,
  getModelEvents,
  getModelKeyBreakdown,
  getModelRequestStats,
  getModelRequests,
} from './model-detail.ts'
import { getModelTimeline } from './model-events.ts'
import { getAdjacentIds, getRequestById, getRequestHistogram, getRequestStats, listRecentRequests } from './requests.ts'

type Handler = (request: Request, match: RegExpMatchArray) => Promise<Response>

type Route = {
  method: string
  pattern: RegExp
  handler: Handler
}

const json = (status: number, body: unknown) => Response.json(body, { status })

const error = (status: number, message: string) => json(status, { error: { message } })

function pickModelContextLength(
  model: Awaited<ReturnType<typeof llamaSwap.listModels>>['data'][number],
): number | null {
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

function pickRunningContextLength(
  running: Awaited<ReturnType<typeof llamaSwap.listRunning>>['running'][number] | undefined,
): number | null {
  if (!running?.cmd) return null
  const match = running.cmd.match(/--ctx-size\s+(\d+)/)
  return match ? Number(match[1]) : null
}

const routes: Array<Route> = [
  {
    method: 'GET',
    pattern: /^\/api\/models$/,
    handler: async () => {
      const [models, running] = await Promise.all([llamaSwap.listModels(), llamaSwap.listRunning()])
      const runningById = new Map(running.running.map((r) => [r.model, r]))
      const configContextLengths = getConfigContextLengths()
      const rows = models.data.map((m) => {
        const run = runningById.get(m.id)
        const peerId = m.meta?.llamaswap?.peerID
        return {
          id: m.id,
          name: m.name ?? m.id,
          kind: peerId ? ('peer' as const) : ('local' as const),
          peerId: peerId ?? null,
          contextLength:
            pickModelContextLength(m) ??
            (peerId ? null : (pickRunningContextLength(run) ?? configContextLengths.get(m.id) ?? null)),
          state: run?.state ?? 'stopped',
          running: Boolean(run),
          ttl: run?.ttl ?? null,
        }
      })
      return json(200, { models: rows })
    },
  },
  {
    method: 'GET',
    pattern: /^\/api\/models\/([^/]+)$/,
    handler: async (_request, match) => {
      const id = decodeURIComponent(match[1])
      const [modelsRes, runningRes] = await Promise.all([llamaSwap.listModels(), llamaSwap.listRunning()])
      const configContextLengths = getConfigContextLengths()
      const modelData = modelsRes.data.find((m) => m.id === id)
      if (!modelData) return error(404, `Model ${id} not found`)

      const runInfo = runningRes.running.find((r) => r.model === id)
      const peerId = modelData.meta?.llamaswap?.peerID
      const model = {
        id: modelData.id,
        name: modelData.name ?? modelData.id,
        kind: peerId ? ('peer' as const) : ('local' as const),
        peerId: peerId ?? null,
        contextLength:
          pickModelContextLength(modelData) ??
          (peerId ? null : (pickRunningContextLength(runInfo) ?? configContextLengths.get(id) ?? null)),
        state: runInfo?.state ?? 'stopped',
        running: Boolean(runInfo),
        ttl: runInfo?.ttl ?? null,
      }

      const [events, stats, requests, keyBreakdown] = await Promise.all([
        getModelEvents(id),
        getModelRequestStats(id),
        getModelRequests(id, 20),
        getModelKeyBreakdown(id),
      ])
      const configSnippet = extractModelConfig(id)

      return json(200, { model, events, stats, requests, configSnippet, keyBreakdown })
    },
  },
  {
    method: 'POST',
    pattern: /^\/api\/models\/([^/]+)\/load$/,
    handler: async (_request, match) => {
      const id = decodeURIComponent(match[1])
      await llamaSwap.loadModel(id)
      return json(200, { ok: true })
    },
  },
  {
    method: 'POST',
    pattern: /^\/api\/models\/([^/]+)\/unload$/,
    handler: async (_request, match) => {
      const id = decodeURIComponent(match[1])
      await llamaSwap.unloadModel(id)
      return json(200, { ok: true })
    },
  },
  {
    method: 'POST',
    pattern: /^\/api\/models\/unload$/,
    handler: async () => {
      await llamaSwap.unloadAll()
      return json(200, { ok: true })
    },
  },
  {
    method: 'GET',
    pattern: /^\/api\/requests$/,
    handler: async (request) => {
      const url = new URL(request.url)
      const limit = clamp(parseInt(url.searchParams.get('limit') ?? '50', 10), 1, 500)
      const cursor = url.searchParams.get('cursor')
      const rows = listRecentRequests({
        limit,
        cursor: cursor ?? undefined,
      })
      return json(200, {
        requests: rows,
        nextCursor: rows.length === limit ? rows[rows.length - 1].id : null,
      })
    },
  },
  {
    method: 'GET',
    pattern: /^\/api\/requests\/stats$/,
    handler: async () => {
      return json(200, getRequestStats())
    },
  },
  {
    method: 'GET',
    pattern: /^\/api\/requests\/histogram$/,
    handler: async (request) => {
      const url = new URL(request.url)
      const windowMs = clamp(parseInt(url.searchParams.get('window') ?? '3600000', 10), 60_000, 86_400_000)
      const bucketMs = clamp(parseInt(url.searchParams.get('bucket') ?? '60000', 10), 10_000, 600_000)
      return json(200, { buckets: getRequestHistogram(windowMs, bucketMs) })
    },
  },
  {
    method: 'GET',
    pattern: /^\/api\/requests\/([a-zA-Z0-9_]+)$/,
    handler: async (_request, match) => {
      const id = match[1]
      const row = getRequestById(id)
      if (!row) return error(404, `Request ${id} not found`)
      const { prevId, nextId } = getAdjacentIds(id)
      return json(200, { request: row, prevId, nextId })
    },
  },
  {
    method: 'GET',
    pattern: /^\/api\/gpu$/,
    handler: async () => {
      return json(200, getGpuSnapshot())
    },
  },
  {
    method: 'GET',
    pattern: /^\/api\/model-timeline$/,
    handler: async (request) => {
      const url = new URL(request.url)
      const windowMs = clamp(parseInt(url.searchParams.get('window') ?? '1800000', 10), 60_000, 86_400_000)
      return json(200, { events: getModelTimeline(windowMs) })
    },
  },
  {
    method: 'GET',
    pattern: /^\/api\/events$/,
    handler: async (request) => {
      const upstream = await fetch(`${config.llamaSwapUrl}/api/events`)
      if (!upstream.ok || !upstream.body) {
        return error(502, 'Failed to connect to llama-swap event stream')
      }
      const upstreamReader = upstream.body.getReader()
      const body = new ReadableStream<Uint8Array>({
        async pull(controller) {
          const { done, value } = await upstreamReader.read()
          if (done) {
            controller.close()
            return
          }
          controller.enqueue(value)
        },
        cancel() {
          upstreamReader.cancel().catch(() => {})
        },
      })
      request.signal.addEventListener('abort', () => {
        upstreamReader.cancel().catch(() => {})
      })
      return new Response(body, {
        status: 200,
        headers: {
          'content-type': 'text/event-stream',
          'cache-control': 'no-cache',
          connection: 'keep-alive',
        },
      })
    },
  },
  {
    method: 'GET',
    pattern: /^\/api\/config$/,
    handler: async () => {
      if (!config.llamaSwapConfigFile) {
        return error(404, 'LLAMASWAP_CONFIG_FILE is not set')
      }
      try {
        const result = readConfig()
        return json(200, result)
      } catch (err) {
        return error(500, err instanceof Error ? err.message : String(err))
      }
    },
  },
  {
    method: 'PUT',
    pattern: /^\/api\/config$/,
    handler: async (request) => {
      if (!config.llamaSwapConfigFile) {
        return error(404, 'LLAMASWAP_CONFIG_FILE is not set')
      }
      let parsed: unknown
      try {
        parsed = await request.json()
      } catch {
        return error(400, 'Invalid JSON body')
      }
      const result = v.safeParse(ConfigSaveBodySchema, parsed)
      if (!result.success) {
        return error(400, 'Body must have "content" (string) and "modifiedAt" (number)')
      }
      const body = result.output
      const validation = await validateAgainstSchema(body.content)
      if (!validation.valid) {
        return json(422, { saved: false, errors: validation.errors })
      }
      const writeResult = writeConfig(body.content, body.modifiedAt)
      if (writeResult.conflict) {
        return json(409, { saved: false, conflict: true, message: 'File was modified externally' })
      }
      return json(200, { saved: true, modifiedAt: writeResult.modifiedAt })
    },
  },
  {
    method: 'POST',
    pattern: /^\/api\/config\/validate$/,
    handler: async (request) => {
      let parsed: unknown
      try {
        parsed = await request.json()
      } catch {
        return error(400, 'Invalid JSON body')
      }
      const result = v.safeParse(ConfigValidateBodySchema, parsed)
      if (!result.success) {
        return error(400, 'Body must have "content" (string)')
      }
      const validation = await validateAgainstSchema(result.output.content)
      return json(200, validation)
    },
  },
  {
    method: 'GET',
    pattern: /^\/api\/aliases$/,
    handler: async () => {
      return json(200, { aliases: listModelAliases() })
    },
  },
  {
    method: 'POST',
    pattern: /^\/api\/aliases$/,
    handler: async (request) => {
      let parsed: unknown
      try {
        parsed = await request.json()
      } catch {
        return error(400, 'Invalid JSON body')
      }
      const result = v.safeParse(CreateModelAliasBodySchema, parsed)
      if (!result.success) {
        return error(400, 'Body must have "alias" and "model" (non-empty strings)')
      }
      try {
        const alias = createModelAlias(result.output)
        return json(201, alias)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        if (msg.includes('UNIQUE constraint')) {
          return error(409, `Alias '${result.output.alias}' already exists`)
        }
        throw err
      }
    },
  },
  {
    method: 'PATCH',
    pattern: /^\/api\/aliases\/([a-zA-Z0-9_]+)$/,
    handler: async (request, match) => {
      const id = match[1]
      let parsed: unknown
      try {
        parsed = await request.json()
      } catch {
        return error(400, 'Invalid JSON body')
      }
      const result = v.safeParse(UpdateModelAliasBodySchema, parsed)
      if (!result.success) {
        return error(400, 'Body must have "alias" and/or "model" (non-empty strings)')
      }
      if (!result.output.alias && !result.output.model) {
        return error(400, 'At least one field to update is required')
      }
      try {
        const updated = updateModelAlias(id, result.output)
        if (!updated) return error(404, `Alias ${id} not found`)
        return json(200, updated)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        if (msg.includes('UNIQUE constraint')) {
          return error(409, `Alias '${result.output.alias}' already exists`)
        }
        throw err
      }
    },
  },
  {
    method: 'DELETE',
    pattern: /^\/api\/aliases\/([a-zA-Z0-9_]+)$/,
    handler: async (_request, match) => {
      const id = match[1]
      const ok = deleteModelAlias(id)
      if (!ok) return error(404, `Alias ${id} not found`)
      return json(200, { ok: true })
    },
  },
  {
    method: 'GET',
    pattern: /^\/api\/settings\/request-limits$/,
    handler: async () => {
      return json(200, getRequestLimits())
    },
  },
  {
    method: 'PATCH',
    pattern: /^\/api\/settings\/request-limits$/,
    handler: async (request) => {
      let parsed: unknown
      try {
        parsed = await request.json()
      } catch {
        return error(400, 'Invalid JSON body')
      }
      const result = v.safeParse(UpdateRequestLimitsBodySchema, parsed)
      if (!result.success) {
        return error(400, 'Invalid request limits body')
      }
      setRequestLimits(result.output)
      return json(200, getRequestLimits())
    },
  },
  {
    method: 'GET',
    pattern: /^\/api\/keys$/,
    handler: async () => {
      return json(200, { keys: listApiKeys() })
    },
  },
  {
    method: 'POST',
    pattern: /^\/api\/keys$/,
    handler: async (request) => {
      let parsed: unknown
      try {
        parsed = await request.json()
      } catch {
        return error(400, 'Invalid JSON body')
      }
      const result = v.safeParse(CreateApiKeyBodySchema, parsed)
      if (!result.success) {
        return error(400, 'Body must have "name" (non-empty string)')
      }
      const created = createApiKey(result.output)
      return json(201, created)
    },
  },
  {
    method: 'GET',
    pattern: /^\/api\/keys\/([a-zA-Z0-9_]+)$/,
    handler: async (_request, match) => {
      const id = match[1]
      const key = getApiKeyById(id)
      if (!key) return error(404, `Key ${id} not found`)

      const [stats, requests, modelBreakdown] = await Promise.all([
        getKeyStats(id),
        getKeyRequests(id, 20),
        getKeyModelBreakdown(id),
      ])

      return json(200, { key, stats, requests, modelBreakdown })
    },
  },
  {
    method: 'PATCH',
    pattern: /^\/api\/keys\/([a-zA-Z0-9_]+)$/,
    handler: async (request, match) => {
      const id = match[1]
      let parsed: unknown
      try {
        parsed = await request.json()
      } catch {
        return error(400, 'Invalid JSON body')
      }
      const result = v.safeParse(UpdateApiKeyBodySchema, parsed)
      if (!result.success) {
        return error(400, 'Body must have "name" (string) and/or "allowedModels" (string[])')
      }
      const body = result.output
      if (!body.name && !body.allowedModels && body.defaultModel === undefined && body.systemPrompt === undefined) {
        return error(400, 'At least one field to update is required')
      }
      const ok = updateApiKey(id, {
        name: body.name?.trim(),
        allowedModels: body.allowedModels,
        defaultModel: body.defaultModel,
        systemPrompt: body.systemPrompt,
      })
      if (!ok) return error(404, `Key ${id} not found`)
      return json(200, { ok: true })
    },
  },
  {
    method: 'POST',
    pattern: /^\/api\/keys\/([a-zA-Z0-9_]+)\/revoke$/,
    handler: async (_request, match) => {
      const id = match[1]
      const ok = revokeApiKey(id)
      if (!ok) return error(404, `Key ${id} not found or already revoked`)
      return json(200, { ok: true })
    },
  },
  {
    method: 'DELETE',
    pattern: /^\/api\/keys\/([a-zA-Z0-9_]+)$/,
    handler: async (_request, match) => {
      const id = match[1]
      const ok = deleteApiKey(id)
      if (!ok) return error(404, `Key ${id} not found`)
      return json(200, { ok: true })
    },
  },
  {
    method: 'GET',
    pattern: /^\/api\/playground-key$/,
    handler: async () => {
      const raw = getSystemKeyRaw()
      if (!raw) return error(500, 'System key not available')
      return json(200, { key: raw })
    },
  },
  {
    method: 'GET',
    pattern: /^\/api\/health$/,
    handler: async () => {
      try {
        const host = new URL(config.llamaSwapUrl).host
        const t0 = performance.now()
        const [health, version] = await Promise.all([llamaSwap.health(), llamaSwap.version()])
        const latencyMs = Math.round(performance.now() - t0)
        return json(200, {
          upstream: { reachable: true, host, health: health.trim(), latencyMs, ...version },
        })
      } catch (err) {
        return json(200, {
          upstream: {
            reachable: false,
            error: err instanceof Error ? err.message : String(err),
          },
        })
      }
    },
  },
]

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))

export async function handleAdminRequest(request: Request): Promise<Response> {
  const method = request.method.toUpperCase()
  const pathname = new URL(request.url).pathname

  for (const route of routes) {
    if (route.method !== method) continue
    const match = pathname.match(route.pattern)
    if (!match) continue
    try {
      return await route.handler(request, match)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return error(502, message)
    }
  }

  return error(404, `No admin route for ${method} ${pathname}`)
}
