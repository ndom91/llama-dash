import type { ApiRequest } from '../../lib/api'

export const REQUESTS_ROW_HEIGHT = 37

// columns: t, endpoint, api-key, model, status, tok-in, tok-out, cache, cost, duration
export type RequestsColKey =
  | 't'
  | 'endpoint'
  | 'apiKey'
  | 'model'
  | 'status'
  | 'tokIn'
  | 'tokOut'
  | 'cache'
  | 'cost'
  | 'duration'

const ALL_COL_WIDTHS: Record<RequestsColKey, number | string> = {
  t: 132,
  endpoint: '18%',
  apiKey: '12%',
  model: '20%',
  status: 70,
  tokIn: 80,
  tokOut: 80,
  cache: 80,
  cost: 80,
  duration: 110,
}

export const REQUESTS_ALL_COLS: readonly RequestsColKey[] = [
  't',
  'endpoint',
  'apiKey',
  'model',
  'status',
  'tokIn',
  'tokOut',
  'cache',
  'cost',
  'duration',
]

export function colWidthsFor(visible: ReadonlySet<RequestsColKey>): (number | string)[] {
  return REQUESTS_ALL_COLS.filter((k) => visible.has(k)).map((k) => ALL_COL_WIDTHS[k])
}

export const REQUESTS_COL_WIDTHS = colWidthsFor(new Set(REQUESTS_ALL_COLS))

export type SortKey = 'startedAt' | 'durationMs' | 'statusCode' | 'totalTokens'
export type SortDir = 'asc' | 'desc'
export type StatusFilter = 'all' | 'ok' | 'err'
export type RoutingFilter = 'all' | 'routed' | 'unrouted'

export const REQUEST_KEY_FILTER_NONE = '__none__'
export const REQUEST_KEY_FILTER_PROXY = '__proxy__'
const REQUEST_KEY_FILTER_KEY_PREFIX = 'key:'

type RequestKeySource = {
  keyName: string | null
  routingAuthMode: string | null
}

export function isProxyRequestKey(r: RequestKeySource): boolean {
  return r.keyName == null && r.routingAuthMode === 'passthrough'
}

export function requestKeyLabel(r: RequestKeySource): string {
  if (isProxyRequestKey(r)) return 'proxy'
  return r.keyName ?? 'system'
}

export function requestKeyFilterValue(r: RequestKeySource): string {
  if (isProxyRequestKey(r)) return REQUEST_KEY_FILTER_PROXY
  return r.keyName ? requestKeyNameFilterValue(r.keyName) : REQUEST_KEY_FILTER_NONE
}

export function requestKeyNameFilterValue(keyName: string): string {
  return `${REQUEST_KEY_FILTER_KEY_PREFIX}${encodeURIComponent(keyName)}`
}

export function requestMatchesKeyFilter(r: RequestKeySource, filter: string): boolean {
  if (filter === REQUEST_KEY_FILTER_PROXY) return isProxyRequestKey(r)
  if (filter === REQUEST_KEY_FILTER_NONE) return r.keyName == null && !isProxyRequestKey(r)
  if (filter.startsWith(REQUEST_KEY_FILTER_KEY_PREFIX)) return requestKeyFilterValue(r) === filter
  return r.keyName === filter
}

export function sortVal(r: ApiRequest, key: SortKey): number | string {
  switch (key) {
    case 'startedAt':
      return r.startedAt
    case 'durationMs':
      return r.durationMs
    case 'statusCode':
      return r.statusCode
    case 'totalTokens':
      return r.totalTokens ?? 0
  }
}

export function formatWhen(iso: string): string {
  const date = new Date(iso)
  const now = new Date()
  const sameDay = date.toDateString() === now.toDateString()
  if (sameDay) return date.toLocaleTimeString([], { hour12: false })
  return date.toLocaleString([], {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}
