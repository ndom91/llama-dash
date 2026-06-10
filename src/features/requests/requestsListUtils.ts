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
