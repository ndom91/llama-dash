import { requestCursor } from '../../../lib/request-sort.ts'
import { parseRequestSearch } from '../request-search.ts'
import {
  countRecentMcpRequests,
  countMatchingRequests,
  getAdjacentIds,
  getFilteredRequestHistogram,
  getRequestHistogram,
  getRequestMetadataById,
  getRequestPayloadsById,
  getRequestStats,
  listRecentRequests,
  listRequestSession,
  requestFilterCounts,
  requestFilterOptions,
} from '../requests.ts'
import { clamp, error, json, type Route } from './types.ts'

export const requestRoutes: Route[] = [
  {
    method: 'GET',
    pattern: /^\/api\/requests\/count$/,
    handler: async (request) => {
      const filters = parseRequestSearch(new URL(request.url).searchParams)
      if (filters instanceof Response) return filters
      return json(200, { count: countMatchingRequests(filters) })
    },
  },
  {
    method: 'GET',
    pattern: /^\/api\/requests\/filter-options$/,
    handler: async () => json(200, requestFilterOptions()),
  },
  {
    method: 'GET',
    pattern: /^\/api\/requests\/filter-counts$/,
    handler: async (request) => {
      const filters = parseRequestSearch(new URL(request.url).searchParams)
      if (filters instanceof Response) return filters
      return json(200, requestFilterCounts(filters))
    },
  },
  {
    method: 'GET',
    pattern: /^\/api\/requests\/([a-zA-Z0-9_]+)\/session$/,
    handler: async (request, match) => {
      const params = new URL(request.url).searchParams
      const order = params.get('order') ?? 'asc'
      if (order !== 'asc' && order !== 'desc') return error(400, 'Invalid session order')
      const cursor = params.get('cursor') ?? undefined
      if (
        cursor &&
        (!/^(?:\d{1,16}:)?[a-zA-Z0-9_]+$/.test(cursor) ||
          (cursor.includes(':') && !Number.isSafeInteger(Number(cursor.split(':', 1)[0]))))
      )
        return error(400, 'Invalid session cursor')
      const limit = params.get('limit')
      if (limit !== null && (!/^\d+$/.test(limit) || Number(limit) < 1 || Number(limit) > 20))
        return error(400, 'Invalid session limit')
      const session = listRequestSession(match[1], cursor, order, limit === null ? 20 : Number(limit))
      if (!session) return error(404, `Request ${match[1]} not found`)
      return json(200, session, { noStore: true })
    },
  },
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
      const filters = parseRequestSearch(url.searchParams)
      if (filters instanceof Response) return filters
      const rows = listRecentRequests({ ...filters, limit: limit + 1 })
      const mcpHiddenCount =
        url.searchParams.get('skipMcpCount') === 'true'
          ? undefined
          : filters.includeMcp
            ? 0
            : countRecentMcpRequests(filters)
      return json(200, {
        requests: rows.slice(0, limit),
        nextCursor: rows.length > limit ? requestCursor(rows[limit - 1], filters) : null,
        ...(mcpHiddenCount === undefined ? {} : { mcpHiddenCount }),
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
      if (url.searchParams.has('timeframe')) {
        const filters = parseRequestSearch(url.searchParams)
        if (filters instanceof Response) return filters
        return json(200, getFilteredRequestHistogram(filters))
      }
      const windowMs = clamp(parseInt(url.searchParams.get('window') ?? '3600000', 10), 60_000, 86_400_000)
      const bucketMs = clamp(parseInt(url.searchParams.get('bucket') ?? '60000', 10), 10_000, 600_000)
      return json(200, { buckets: getRequestHistogram(windowMs, bucketMs) })
    },
  },
]
