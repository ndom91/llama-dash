import type { ApiUsageBreakdownRow, UsageDimension } from '../../lib/api'
import type { RequestsSearch } from '../../routes/requests.index'
import { requestKeyNameFilterValue } from '../requests/requestsListUtils'

type DimensionMeta = {
  /** Panel title: "By <title>". */
  title: string
  /** Settings select label. */
  option: string
  /** Column header for the value. */
  column: string
  /** Shown for a null value. */
  nullLabel: string
}

export const USAGE_DIMENSION_META: Record<UsageDimension, DimensionMeta> = {
  client: { title: 'app', option: 'App (client)', column: 'client', nullLabel: 'unattributed' },
  key: { title: 'key', option: 'API key', column: 'key', nullLabel: 'no key' },
  model: { title: 'model', option: 'Model', column: 'model', nullLabel: 'unknown' },
  status: { title: 'status', option: 'Status (2xx / 4xx / 5xx / error)', column: 'status', nullLabel: 'unknown' },
  routing: { title: 'routing', option: 'Routing action', column: 'action', nullLabel: 'no rule' },
  host: { title: 'host', option: 'Client host', column: 'host', nullLabel: 'no host' },
  endUser: { title: 'end user', option: 'End user', column: 'end user', nullLabel: 'unattributed' },
  session: { title: 'session', option: 'Session', column: 'session', nullLabel: 'no session' },
}

/** Display text for a breakdown row. */
export function usageRowLabel(dimension: UsageDimension, row: ApiUsageBreakdownRow): string {
  if (dimension === 'key' && row.value != null) return row.label ?? `deleted · ${row.value.slice(0, 8)}`
  return row.label ?? row.value ?? USAGE_DIMENSION_META[dimension].nullLabel
}

/**
 * Requests page filter matching a breakdown row, or null when the Requests
 * page has no filter that selects exactly (or close enough to) that row.
 */
export function usageRowRequestsSearch(dimension: UsageDimension, row: ApiUsageBreakdownRow): RequestsSearch | null {
  const { value } = row
  switch (dimension) {
    case 'status':
      if (value === '2xx' || value === '3xx') return { status: 'ok' }
      if (value === '4xx' || value === '5xx') return { status: 'err' }
      return null
    case 'routing':
      return { routing: value == null ? 'unrouted' : 'routed' }
    case 'host':
      return { host: value ?? '__none__' }
    case 'key':
      return value != null && row.label != null ? { key: requestKeyNameFilterValue(row.label) } : null
    case 'model':
      // The Requests filter matches requested models, not routed rollup models.
      return null
    case 'client':
      return value != null ? { client: value } : null
    case 'endUser':
      return value != null ? { endUser: value } : null
    case 'session':
      return value != null ? { session: value } : null
  }
}
