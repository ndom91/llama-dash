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

export const REQUEST_HOST_FILTER_NONE = '__none__'

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
