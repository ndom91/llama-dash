import type { SelectOption } from '../../components/Select'
import { isProxyRequestKey } from '../../lib/request-filters'

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

export type { SortKey, SortDir } from '../../lib/request-sort'

export type { RequestListFilters, RoutingFilter, StatusFilter } from '../../lib/request-filters'
export {
  isProxyRequestKey,
  REQUEST_HOST_FILTER_NONE,
  REQUEST_KEY_FILTER_NONE,
  REQUEST_KEY_FILTER_PROXY,
  requestKeyNameFilterValue,
} from '../../lib/request-filters'

export function requestKeyLabel(r: { keyName: string | null; routingAuthMode: string | null }): string {
  if (isProxyRequestKey(r)) return 'proxy'
  return r.keyName ?? 'system'
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
