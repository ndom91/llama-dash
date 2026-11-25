export type StatusFilter = 'all' | 'ok' | 'err'
export type RoutingValue = 'routed' | 'unrouted'
export const ROUTING_VALUES: readonly RoutingValue[] = ['routed', 'unrouted']

/**
 * A multi-value filter stored as whichever side is smaller. Everything selected is an empty
 * exclusion (the filter is off, so options created later are included); nothing selected is an
 * empty inclusion.
 */
export type SetFilter = { mode: 'include' | 'exclude'; values: readonly string[] }
export type RoutingFilter = SetFilter

export const ALL_SET_FILTER: SetFilter = { mode: 'exclude', values: [] }

export function isSetFilterActive(filter: SetFilter): boolean {
  return filter.mode === 'include' || filter.values.length > 0
}

export function isSetFilterEmpty(filter: SetFilter): boolean {
  return filter.mode === 'include' && filter.values.length === 0
}

export function setFilterIncludes(filter: SetFilter, value: string): boolean {
  return filter.values.includes(value) === (filter.mode === 'include')
}

/** Whether a row passes `filter`, given a predicate for "the row matches this option value". */
export function setFilterMatches(filter: SetFilter, matches: (value: string) => boolean): boolean {
  if (!isSetFilterActive(filter)) return true
  return filter.values.some(matches) === (filter.mode === 'include')
}

/**
 * Builds the filter for `checked` out of `options`. Half or fewer unchecked is stored as an
 * exclusion, more than half as an inclusion. Checked values missing from `options` are kept.
 */
export function setFilterFromChecked(options: readonly string[], checked: ReadonlySet<string>): SetFilter {
  const unchecked = options.filter((o) => !checked.has(o))
  if (unchecked.length === 0) return ALL_SET_FILTER
  if (unchecked.length <= options.length / 2) return { mode: 'exclude', values: unchecked }
  return { mode: 'include', values: options.filter((o) => checked.has(o)) }
}

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

/** Display label for a key filter value, used for values no longer in the key list. */
export function requestKeyFilterLabel(value: string): string {
  if (value === REQUEST_KEY_FILTER_PROXY) return 'proxy'
  if (value === REQUEST_KEY_FILTER_NONE) return 'No key'
  if (!value.startsWith(REQUEST_KEY_FILTER_KEY_PREFIX)) return value
  try {
    return decodeURIComponent(value.slice(REQUEST_KEY_FILTER_KEY_PREFIX.length))
  } catch {
    return value
  }
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
  modelFilter: SetFilter
  keyFilter: SetFilter
  routingFilter: SetFilter
  clientFilter: string
  hostFilter: SetFilter
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

  out = out.filter(
    (r) =>
      setFilterMatches(filters.modelFilter, (f) => r.model === f) &&
      setFilterMatches(filters.keyFilter, (f) => requestMatchesKeyFilter(r, f)) &&
      setFilterMatches(filters.routingFilter, (f) => f === (r.routingActionType == null ? 'unrouted' : 'routed')) &&
      setFilterMatches(filters.hostFilter, (f) => f === (r.clientHost ?? REQUEST_HOST_FILTER_NONE)),
  )

  if (client) {
    out = out.filter((r) => (r.clientName ?? '').toLowerCase().includes(client))
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
