import type { SelectOption } from '../../components/Select'
import type { ApiRequest } from '../../lib/api'

export const REQUESTS_ROW_HEIGHT = 37

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

function requestKeyFilterValue(r: RequestKeySource): string {
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

export const REQUEST_HOST_FILTER_NONE = '__none__'

export function toOption(value: string): SelectOption {
  return { value, label: value }
}

export function uniqueSorted<T>(rows: ReadonlyArray<T>, pick: (row: T) => string | null | undefined): Array<string> {
  const set = new Set<string>()
  for (const row of rows) {
    const value = pick(row)
    if (value) set.add(value)
  }
  return Array.from(set).sort()
}

/** Keeps selected values listed even when the loaded page no longer contains them. */
export function withSelected(options: SelectOption[], selected: readonly string[]): SelectOption[] {
  const known = new Set(options.map((o) => o.value))
  const missing = selected.filter((v) => !known.has(v)).map(toOption)
  return missing.length > 0 ? [...options, ...missing] : options
}

export function isMcpRelayRequest(row: { requestClass: string }): boolean {
  return row.requestClass === 'mcp_relay'
}

export type RequestListFilters = {
  statusFilter: StatusFilter
  modelFilter: readonly string[]
  keyFilter: readonly string[]
  routingFilter: RoutingFilter
  clientFilter: string
  hostFilter: readonly string[]
  endUserFilter: string
  sessionFilter: string
}

type RequestFilterRow = {
  statusCode: number
  model: string | null
  keyName: string | null
  routingAuthMode: string | null
  routingActionType: string | null
  clientName: string | null
  clientHost: string | null
  endUserId: string | null
  sessionId: string | null
  endpoint: string
  method: string
}

export function applyRequestFilters<T extends RequestFilterRow>(
  rows: T[],
  filters: RequestListFilters & { search: string },
) {
  let out = rows
  const client = filters.clientFilter.toLowerCase()
  const endUser = filters.endUserFilter.toLowerCase()
  const session = filters.sessionFilter.toLowerCase()
  const query = filters.search.toLowerCase()

  if (filters.statusFilter === 'ok') out = out.filter((r) => r.statusCode >= 200 && r.statusCode < 400)
  else if (filters.statusFilter === 'err') out = out.filter((r) => r.statusCode >= 400)

  if (filters.modelFilter.length > 0) out = out.filter((r) => r.model != null && filters.modelFilter.includes(r.model))

  if (filters.keyFilter.length > 0) {
    out = out.filter((r) => filters.keyFilter.some((f) => requestMatchesKeyFilter(r, f)))
  }

  if (filters.routingFilter === 'routed') out = out.filter((r) => r.routingActionType != null)
  else if (filters.routingFilter === 'unrouted') out = out.filter((r) => r.routingActionType == null)

  if (client) {
    out = out.filter((r) => (r.clientName ?? '').toLowerCase().includes(client))
  }
  if (filters.hostFilter.length > 0) {
    out = out.filter((r) => filters.hostFilter.includes(r.clientHost ?? REQUEST_HOST_FILTER_NONE))
  }
  if (endUser) {
    out = out.filter((r) => (r.endUserId ?? '').toLowerCase().includes(endUser))
  }
  if (session) {
    out = out.filter((r) => (r.sessionId ?? '').toLowerCase().includes(session))
  }

  if (query) {
    out = out.filter(
      (r) =>
        r.endpoint.toLowerCase().includes(query) ||
        r.method.toLowerCase().includes(query) ||
        (r.model?.toLowerCase().includes(query) ?? false) ||
        (r.clientName?.toLowerCase().includes(query) ?? false) ||
        (r.clientHost?.toLowerCase().includes(query) ?? false) ||
        (r.endUserId?.toLowerCase().includes(query) ?? false) ||
        (r.sessionId?.toLowerCase().includes(query) ?? false) ||
        String(r.statusCode).includes(query),
    )
  }

  return out
}
