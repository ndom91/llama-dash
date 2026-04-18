import type { IncomingMessage, ServerResponse } from 'node:http'
import * as v from 'valibot'
import { ConfigSaveBodySchema, ConfigValidateBodySchema } from '../../lib/schemas/config'
import { config } from '../config.ts'
import { getGpuSnapshot } from '../gpu-poller.ts'
import { llamaSwap } from '../llama-swap/client.ts'
import { readConfig, validateAgainstSchema, writeConfig } from './config.ts'
import { getModelTimeline } from './model-events.ts'
import { getAdjacentIds, getRequestById, getRequestHistogram, getRequestStats, listRecentRequests } from './requests.ts'

type Handler = (req: IncomingMessage, res: ServerResponse, match: RegExpMatchArray) => Promise<void> | void

type Route = {
  method: string
  pattern: RegExp
  handler: Handler
}

const json = (res: ServerResponse, status: number, body: unknown) => {
  res.statusCode = status
  res.setHeader('content-type', 'application/json')
  res.end(JSON.stringify(body))
}

const error = (res: ServerResponse, status: number, message: string) => json(res, status, { error: { message } })

const routes: Array<Route> = [
  {
    method: 'GET',
    pattern: /^\/api\/models$/,
    handler: async (_req, res) => {
      const [models, running] = await Promise.all([llamaSwap.listModels(), llamaSwap.listRunning()])
      const runningById = new Map(running.running.map((r) => [r.model, r]))
      const rows = models.data.map((m) => {
        const run = runningById.get(m.id)
        const peerId = m.meta?.llamaswap?.peerID
        return {
          id: m.id,
          name: m.name ?? m.id,
          kind: peerId ? ('peer' as const) : ('local' as const),
          peerId: peerId ?? null,
          state: run?.state ?? 'stopped',
          running: Boolean(run),
          ttl: run?.ttl ?? null,
        }
      })
      json(res, 200, { models: rows })
    },
  },
  {
    method: 'POST',
    pattern: /^\/api\/models\/([^/]+)\/load$/,
    handler: async (_req, res, match) => {
      const id = decodeURIComponent(match[1])
      await llamaSwap.loadModel(id)
      json(res, 200, { ok: true })
    },
  },
  {
    method: 'POST',
    pattern: /^\/api\/models\/([^/]+)\/unload$/,
    handler: async (_req, res, match) => {
      const id = decodeURIComponent(match[1])
      await llamaSwap.unloadModel(id)
      json(res, 200, { ok: true })
    },
  },
  {
    method: 'POST',
    pattern: /^\/api\/models\/unload$/,
    handler: async (_req, res) => {
      await llamaSwap.unloadAll()
      json(res, 200, { ok: true })
    },
  },
  {
    method: 'GET',
    pattern: /^\/api\/requests$/,
    handler: async (req, res) => {
      const url = new URL(req.url ?? '/', 'http://localhost')
      const limit = clamp(parseInt(url.searchParams.get('limit') ?? '50', 10), 1, 500)
      const cursor = url.searchParams.get('cursor')
      const rows = listRecentRequests({
        limit,
        cursor: cursor ?? undefined,
      })
      json(res, 200, {
        requests: rows,
        nextCursor: rows.length === limit ? rows[rows.length - 1].id : null,
      })
    },
  },
  {
    method: 'GET',
    pattern: /^\/api\/requests\/stats$/,
    handler: async (_req, res) => {
      json(res, 200, getRequestStats())
    },
  },
  {
    method: 'GET',
    pattern: /^\/api\/requests\/histogram$/,
    handler: async (req, res) => {
      const url = new URL(req.url ?? '/', 'http://localhost')
      const windowMs = clamp(parseInt(url.searchParams.get('window') ?? '3600000', 10), 60_000, 86_400_000)
      const bucketMs = clamp(parseInt(url.searchParams.get('bucket') ?? '60000', 10), 10_000, 600_000)
      json(res, 200, { buckets: getRequestHistogram(windowMs, bucketMs) })
    },
  },
  {
    method: 'GET',
    pattern: /^\/api\/requests\/([a-zA-Z0-9_]+)$/,
    handler: async (_req, res, match) => {
      const id = match[1]
      const row = getRequestById(id)
      if (!row) return error(res, 404, `Request ${id} not found`)
      const { prevId, nextId } = getAdjacentIds(id)
      json(res, 200, { request: row, prevId, nextId })
    },
  },
  {
    method: 'GET',
    pattern: /^\/api\/gpu$/,
    handler: async (_req, res) => {
      json(res, 200, getGpuSnapshot())
    },
  },
  {
    method: 'GET',
    pattern: /^\/api\/model-timeline$/,
    handler: async (req, res) => {
      const url = new URL(req.url ?? '/', 'http://localhost')
      const windowMs = clamp(parseInt(url.searchParams.get('window') ?? '1800000', 10), 60_000, 86_400_000)
      json(res, 200, { events: getModelTimeline(windowMs) })
    },
  },
  {
    method: 'GET',
    pattern: /^\/api\/events$/,
    handler: async (req, res) => {
      const upstream = await fetch(`${config.llamaSwapUrl}/api/events`)
      if (!upstream.ok || !upstream.body) {
        return error(res, 502, 'Failed to connect to llama-swap event stream')
      }
      res.writeHead(200, {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache',
        connection: 'keep-alive',
      })
      const reader = upstream.body.getReader()
      const pump = async () => {
        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          if (!res.writable) break
          res.write(value)
        }
        if (!res.writableEnded) res.end()
      }
      req.on('close', () => {
        reader.cancel().catch(() => {})
        if (!res.writableEnded) res.end()
      })
      await pump()
    },
  },
  {
    method: 'GET',
    pattern: /^\/api\/config$/,
    handler: async (_req, res) => {
      if (!config.llamaSwapConfigFile) {
        return error(res, 404, 'LLAMASWAP_CONFIG_FILE is not set')
      }
      try {
        const result = readConfig()
        json(res, 200, result)
      } catch (err) {
        error(res, 500, err instanceof Error ? err.message : String(err))
      }
    },
  },
  {
    method: 'PUT',
    pattern: /^\/api\/config$/,
    handler: async (req, res) => {
      if (!config.llamaSwapConfigFile) {
        return error(res, 404, 'LLAMASWAP_CONFIG_FILE is not set')
      }
      const raw = await readBody(req)
      let parsed: unknown
      try {
        parsed = JSON.parse(raw)
      } catch {
        return error(res, 400, 'Invalid JSON body')
      }
      const result = v.safeParse(ConfigSaveBodySchema, parsed)
      if (!result.success) {
        return error(res, 400, 'Body must have "content" (string) and "modifiedAt" (number)')
      }
      const body = result.output
      const validation = await validateAgainstSchema(body.content)
      if (!validation.valid) {
        return json(res, 422, { saved: false, errors: validation.errors })
      }
      const writeResult = writeConfig(body.content, body.modifiedAt)
      if (writeResult.conflict) {
        return json(res, 409, { saved: false, conflict: true, message: 'File was modified externally' })
      }
      json(res, 200, { saved: true })
    },
  },
  {
    method: 'POST',
    pattern: /^\/api\/config\/validate$/,
    handler: async (req, res) => {
      const raw = await readBody(req)
      let parsed: unknown
      try {
        parsed = JSON.parse(raw)
      } catch {
        return error(res, 400, 'Invalid JSON body')
      }
      const result = v.safeParse(ConfigValidateBodySchema, parsed)
      if (!result.success) {
        return error(res, 400, 'Body must have "content" (string)')
      }
      const validation = await validateAgainstSchema(result.output.content)
      json(res, 200, validation)
    },
  },
  {
    method: 'GET',
    pattern: /^\/api\/health$/,
    handler: async (_req, res) => {
      try {
        const host = new URL(config.llamaSwapUrl).host
        const t0 = performance.now()
        const [health, version] = await Promise.all([llamaSwap.health(), llamaSwap.version()])
        const latencyMs = Math.round(performance.now() - t0)
        json(res, 200, {
          upstream: { reachable: true, host, health: health.trim(), latencyMs, ...version },
        })
      } catch (err) {
        json(res, 200, {
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

function readBody(req: IncomingMessage, maxBytes = 1024 * 1024): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Array<Buffer> = []
    let size = 0
    req.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > maxBytes) {
        req.destroy()
        reject(new Error('Body too large'))
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')))
    req.on('error', reject)
  })
}

export async function handleAdminRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const method = (req.method ?? 'GET').toUpperCase()
  const pathname = (req.url ?? '/').split('?')[0]

  for (const route of routes) {
    if (route.method !== method) continue
    const match = pathname.match(route.pattern)
    if (!match) continue
    try {
      await route.handler(req, res, match)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      if (!res.headersSent) error(res, 502, message)
      else if (!res.writableEnded) res.end()
    }
    return
  }

  error(res, 404, `No admin route for ${method} ${pathname}`)
}
