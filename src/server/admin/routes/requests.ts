import {
  getAdjacentIds,
  getRequestById,
  getRequestHistogram,
  getRequestStats,
  listRecentRequests,
} from '../requests.ts'
import { clamp, error, json, type Route } from './types.ts'

export const requestRoutes: Route[] = [
  {
    method: 'GET',
    pattern: /^\/api\/requests$/,
    handler: async (request) => {
      const url = new URL(request.url)
      const limit = clamp(parseInt(url.searchParams.get('limit') ?? '50', 10), 1, 500)
      const cursor = url.searchParams.get('cursor')
      const rows = listRecentRequests({ limit, cursor: cursor ?? undefined })
      return json(200, {
        requests: rows,
        nextCursor: rows.length === limit ? rows[rows.length - 1].id : null,
      })
    },
  },
  {
    method: 'GET',
    pattern: /^\/api\/requests\/stats$/,
    handler: async () => json(200, getRequestStats()),
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
]
