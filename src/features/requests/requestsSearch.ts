import * as v from 'valibot'
import {
  RequestIntervalsSchema,
  RequestTimeFilterSchema,
  RequestSortKeySchema,
  RequestSortDirSchema,
  type RequestInterval,
  type RequestTimeFilter,
} from '../../lib/schemas/request-search'
import type { RoutingFilter, SortDir, SortKey, StatusFilter } from './requestsListUtils'

export type RequestsSearch = RequestTimeFilter & {
  ranges?: RequestInterval[]
  q?: string
  status?: StatusFilter
  model?: string[]
  key?: string[]
  routing?: RoutingFilter
  host?: string[]
  client?: string
  endUser?: string
  session?: string
  mcp?: true
  sortKey?: SortKey
  sortDir?: SortDir
}

const STATUS_VALUES: ReadonlyArray<StatusFilter> = ['all', 'ok', 'err']
const ROUTING_VALUES: ReadonlyArray<RoutingFilter> = ['all', 'routed', 'unrouted']
const SORT_KEY_VALUES = RequestSortKeySchema.options
const SORT_DIR_VALUES = RequestSortDirSchema.options

function asString(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined
}

/** Accepts arrays plus legacy single-value links like `?model=foo`. */
function asStringList(v: unknown): string[] | undefined {
  const list = (Array.isArray(v) ? v : [v]).filter((x): x is string => typeof x === 'string' && x.length > 0)
  return list.length > 0 ? list : undefined
}

function asEnum<T extends string>(v: unknown, allowed: ReadonlyArray<T>): T | undefined {
  return typeof v === 'string' && (allowed as ReadonlyArray<string>).includes(v) ? (v as T) : undefined
}

function asTrue(v: unknown): true | undefined {
  return v === true || v === 'true' ? true : undefined
}

export function validateRequestsSearch(search: Record<string, unknown>): RequestsSearch {
  const time = v.safeParse(RequestTimeFilterSchema, {
    timeframe: search.timeframe,
    from: search.from === undefined ? undefined : Number(search.from),
    to: search.to === undefined ? undefined : Number(search.to),
  })
  const ranges = v.safeParse(RequestIntervalsSchema, search.ranges ?? [])
  return {
    ranges: ranges.success && ranges.output.length ? ranges.output : undefined,
    ...(time.success ? time.output : {}),
    q: asString(search.q),
    status: asEnum(search.status, STATUS_VALUES),
    model: asStringList(search.model),
    key: asStringList(search.key),
    routing: asEnum(search.routing, ROUTING_VALUES),
    host: asStringList(search.host),
    client: asString(search.client),
    endUser: asString(search.endUser),
    session: asString(search.session),
    mcp: asTrue(search.mcp),
    sortKey: asEnum(search.sortKey, SORT_KEY_VALUES),
    sortDir: asEnum(search.sortDir, SORT_DIR_VALUES),
  }
}
