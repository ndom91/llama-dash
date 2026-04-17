import type { IncomingMessage, ServerResponse } from 'node:http'
import { llamaSwap } from '../llama-swap/client.ts'
import { getRequestById, listRecentRequests } from './requests.ts'

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
    pattern: /^\/api\/requests\/([a-zA-Z0-9_]+)$/,
    handler: async (_req, res, match) => {
      const id = match[1]
      const row = getRequestById(id)
      if (!row) return error(res, 404, `Request ${id} not found`)
      json(res, 200, { request: row })
    },
  },
  {
    method: 'GET',
    pattern: /^\/api\/health$/,
    handler: async (_req, res) => {
      try {
        const [health, version] = await Promise.all([llamaSwap.health(), llamaSwap.version()])
        json(res, 200, {
          upstream: { reachable: true, health: health.trim(), ...version },
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
