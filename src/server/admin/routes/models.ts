import { getGpuSnapshot } from '../../gpu-poller.ts'
import { inferenceBackend } from '../../inference/backend.ts'
import {
  buildApiModel,
  extractModelConfig,
  getConfigContextLengths,
  getModelEvents,
  getModelKeyBreakdown,
  getModelRequestStats,
  getModelRequests,
} from '../model-detail.ts'
import { getModelTimeline } from '../model-events.ts'
import { clamp, error, json, type Route } from './types.ts'

export const modelRoutes: Route[] = [
  {
    method: 'GET',
    pattern: /^\/api\/models$/,
    handler: async () => {
      const [models, running] = await Promise.all([
        inferenceBackend.listModels(),
        inferenceBackend.listRunning?.() ?? Promise.resolve([]),
      ])
      const runningById = new Map(running.map((r) => [r.model, r]))
      const configContextLengths = getConfigContextLengths()
      const rows = models.map((m) => buildApiModel(m, runningById.get(m.id), configContextLengths))
      return json(200, { models: rows })
    },
  },
  {
    method: 'GET',
    pattern: /^\/api\/models\/([^/]+)$/,
    handler: async (_request, match) => {
      const id = decodeURIComponent(match[1])
      const [modelsRes, runningRes] = await Promise.all([
        inferenceBackend.listModels(),
        inferenceBackend.listRunning?.() ?? Promise.resolve([]),
      ])
      const configContextLengths = getConfigContextLengths()
      const modelData = modelsRes.find((m) => m.id === id)
      if (!modelData) return error(404, `Model ${id} not found`)

      const runInfo = runningRes.find((r) => r.model === id)
      const model = buildApiModel(modelData, runInfo, configContextLengths)

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
      if (!inferenceBackend.loadModel) return error(501, 'Inference backend does not support model loading')
      const id = decodeURIComponent(match[1])
      await inferenceBackend.loadModel(id)
      return json(200, { ok: true })
    },
  },
  {
    method: 'POST',
    pattern: /^\/api\/models\/([^/]+)\/unload$/,
    handler: async (_request, match) => {
      if (!inferenceBackend.unloadModel) return error(501, 'Inference backend does not support model unloading')
      const id = decodeURIComponent(match[1])
      await inferenceBackend.unloadModel(id)
      return json(200, { ok: true })
    },
  },
  {
    method: 'POST',
    pattern: /^\/api\/models\/unload$/,
    handler: async () => {
      if (!inferenceBackend.unloadAll) return error(501, 'Inference backend does not support unloading all models')
      await inferenceBackend.unloadAll()
      return json(200, { ok: true })
    },
  },
  {
    method: 'GET',
    pattern: /^\/api\/gpu$/,
    handler: async () => json(200, getGpuSnapshot()),
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
      if (!inferenceBackend.eventStreamUrl) return error(501, 'Inference backend does not support event streaming')

      const upstream = await fetch(inferenceBackend.eventStreamUrl)
      if (!upstream.ok || !upstream.body) {
        return error(502, 'Failed to connect to inference backend event stream')
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
]
