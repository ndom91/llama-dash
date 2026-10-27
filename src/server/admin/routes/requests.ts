import {
  countRecentMcpRequests,
  getAdjacentIds,
  getRequestById,
  getRequestMetadataById,
  getRequestPayloadsById,
  getRequestHistogram,
  getRequestStats,
  listRecentRequests,
} from '../requests.ts'
import { clamp, error, json, type Route } from './types.ts'

export const requestRoutes: Route[] = [
  {
    method: 'GET',
    pattern: /^\/api\/requests\/([a-zA-Z0-9_]+)\/metadata$/,
    handler: async (_request, match) => {
      const row = getRequestMetadataById(match[1])
      if (!row) return error(404, `Request ${match[1]} not found`)
      return json(200, { request: row, ...getAdjacentIds(match[1]) })
    },
  },
  {
    method: 'GET',
    pattern: /^\/api\/requests\/([a-zA-Z0-9_]+)\/payloads$/,
    handler: async (_request, match) => {
      const payloads = getRequestPayloadsById(match[1])
      if (!payloads) return error(404, `Request ${match[1]} not found`)
      return json(200, payloads, { noStore: true })
    },
  },
  {
    method: 'GET',
    pattern: /^\/api\/requests$/,
    handler: async (request) => {
      const url = new URL(request.url)
      const limit = clamp(parseInt(url.searchParams.get('limit') ?? '50', 10), 1, 500)
      const cursor = url.searchParams.get('cursor')
      const includeMcp = url.searchParams.get('includeMcp') === 'true'
      const status = url.searchParams.get('status')
      if (status !== null && status !== 'ok' && status !== 'err') return error(400, 'Invalid status filter')
      const rawMinutes = url.searchParams.get('minutes')
      const minutes = rawMinutes?.split(',').map(Number)
      if (
        rawMinutes != null &&
        (!/^\d+(,\d+)*$/.test(rawMinutes) ||
          !minutes ||
          minutes.length > 500 ||
          minutes.some((n) => !Number.isSafeInteger(n) || n < 0 || n % 60_000 !== 0 || n > 8_639_999_999_940_000))
      ) {
        return error(400, 'Invalid minute filter')
      }
      const rows = listRecentRequests({
        limit,
        cursor: cursor ?? undefined,
        includeMcp,
        minutes,
        status: status ?? undefined,
      })
      return json(200, {
        requests: rows,
        nextCursor: rows.length === limit ? rows[rows.length - 1].id : null,
        mcpHiddenCount: includeMcp
          ? 0
          : countRecentMcpRequests({ cursor: cursor ?? undefined, minutes, status: status ?? undefined }),
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
      return json(200, { request: row, prevId, nextId }, { noStore: true })
    },
  },
]
