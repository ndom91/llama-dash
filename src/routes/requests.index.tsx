import { createFileRoute } from '@tanstack/react-router'
import { RequestsPage } from '../features/requests/RequestsPage'
import type { RoutingFilter, SortDir, SortKey, StatusFilter } from '../features/requests/requestsListUtils'

export type RequestsSearch = {
  q?: string
  status?: StatusFilter
  model?: string
  key?: string
  routing?: RoutingFilter
  host?: string
  client?: string
  endUser?: string
  session?: string
  sortKey?: SortKey
  sortDir?: SortDir
}

const STATUS_VALUES: ReadonlyArray<StatusFilter> = ['all', 'ok', 'err']
const ROUTING_VALUES: ReadonlyArray<RoutingFilter> = ['all', 'routed', 'unrouted']
const SORT_KEY_VALUES: ReadonlyArray<SortKey> = ['startedAt', 'durationMs', 'statusCode', 'totalTokens']
const SORT_DIR_VALUES: ReadonlyArray<SortDir> = ['asc', 'desc']

function asString(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined
}

function asEnum<T extends string>(v: unknown, allowed: ReadonlyArray<T>): T | undefined {
  return typeof v === 'string' && (allowed as ReadonlyArray<string>).includes(v) ? (v as T) : undefined
}

export const Route = createFileRoute('/requests/')({
  component: RequestsRoute,
  validateSearch: (search: Record<string, unknown>): RequestsSearch => ({
    q: asString(search.q),
    status: asEnum(search.status, STATUS_VALUES),
    model: asString(search.model),
    key: asString(search.key),
    routing: asEnum(search.routing, ROUTING_VALUES),
    host: asString(search.host),
    client: asString(search.client),
    endUser: asString(search.endUser),
    session: asString(search.session),
    sortKey: asEnum(search.sortKey, SORT_KEY_VALUES),
    sortDir: asEnum(search.sortDir, SORT_DIR_VALUES),
  }),
})

function RequestsRoute() {
  return <RequestsPage />
}
