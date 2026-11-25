import * as v from 'valibot'
import { DEFAULT_REQUEST_TIMEFRAME } from '../../lib/request-timeframe'
import {
  RequestIntervalsSchema,
  RequestTimeFilterSchema,
  RequestSortKeySchema,
  RequestSortDirSchema,
  type RequestInterval,
  type RequestTimeFilter,
} from '../../lib/schemas/request-search'
import { ALL_SET_FILTER, ROUTING_VALUES, type RoutingValue, type SetFilter } from '../../lib/request-filters'
import type { SortDir, SortKey, StatusFilter } from './requestsListUtils'

export type RequestsSearch = RequestTimeFilter & {
  ranges?: RequestInterval[]
  q?: string
  status?: StatusFilter
  /** Inclusion lists; an empty list means nothing is selected. */
  model?: string[]
  key?: string[]
  routing?: RoutingValue[]
  host?: string[]
  /** Exclusion lists, used while half or fewer options are unchecked. */
  model_not?: string[]
  key_not?: string[]
  routing_not?: RoutingValue[]
  host_not?: string[]
  client?: string
  endUser?: string
  session?: string
  mcp?: true
  sortKey?: SortKey
  sortDir?: SortDir
}

const STATUS_VALUES: ReadonlyArray<StatusFilter> = ['all', 'ok', 'err']
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

/** Like `asStringList`, but keeps an explicit empty array: that is the "nothing selected" state. */
function asIncludeList(v: unknown): string[] | undefined {
  if (Array.isArray(v) && v.length === 0) return []
  return asStringList(v)
}

function asRoutingList(v: unknown, include: boolean): RoutingValue[] | undefined {
  // Legacy links carried a single `routing=all|routed|unrouted`; `all` means no filter.
  const list = include ? asIncludeList(v) : asStringList(v)
  if (!list || list.includes('all')) return undefined
  const values = ROUTING_VALUES.filter((r) => list.includes(r))
  return values.length > 0 || list.length === 0 ? values : undefined
}

type SetFilterDimension = 'model' | 'key' | 'routing' | 'host'

/** Reads one multi-select filter from the URL. An inclusion list wins over an exclusion list. */
export function setFilterFromSearch(search: RequestsSearch, dim: SetFilterDimension): SetFilter {
  const include = search[dim]
  if (include) return { mode: 'include', values: include }
  const exclude = search[`${dim}_not`]
  return exclude?.length ? { mode: 'exclude', values: exclude } : ALL_SET_FILTER
}

/** The URL patch for one multi-select filter; "all" clears both params. */
export function setFilterSearchPatch(dim: SetFilterDimension, filter: SetFilter): Partial<RequestsSearch> {
  const values = [...filter.values]
  const patch =
    filter.mode === 'include'
      ? { [dim]: values, [`${dim}_not`]: undefined }
      : { [dim]: undefined, [`${dim}_not`]: values.length ? values : undefined }
  return patch as Partial<RequestsSearch>
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
    timeframe: time.success ? (time.output.timeframe ?? DEFAULT_REQUEST_TIMEFRAME) : DEFAULT_REQUEST_TIMEFRAME,
    q: asString(search.q),
    status: asEnum(search.status, STATUS_VALUES),
    model: asIncludeList(search.model),
    key: asIncludeList(search.key),
    routing: asRoutingList(search.routing, true),
    host: asIncludeList(search.host),
    model_not: asStringList(search.model_not),
    key_not: asStringList(search.key_not),
    routing_not: asRoutingList(search.routing_not, false),
    host_not: asStringList(search.host_not),
    client: asString(search.client),
    endUser: asString(search.endUser),
    session: asString(search.session),
    mcp: asTrue(search.mcp),
    sortKey: asEnum(search.sortKey, SORT_KEY_VALUES),
    sortDir: asEnum(search.sortDir, SORT_DIR_VALUES),
  }
}
