import * as v from 'valibot'
import { parseRequestCursor, RequestSortDirSchema, RequestSortKeySchema } from '../../lib/request-sort.ts'
import { RequestIntervalsSchema, RequestTimeFilterSchema } from '../../lib/request-timeframe.ts'
import type { RequestSearchOptions } from './requests.ts'
import { error } from './routes/types.ts'

export function parseRequestSearch(params: URLSearchParams): RequestSearchOptions | Response {
  const ranges = v.safeParse(v.pipe(v.string(), v.parseJson(), RequestIntervalsSchema), params.get('ranges') ?? '[]')
  if (!ranges.success) return error(400, 'Invalid time intervals')
  const cursor = params.get('cursor')
  const time = v.safeParse(RequestTimeFilterSchema, {
    timeframe: params.get('timeframe') ?? undefined,
    from: params.has('from') ? Number(params.get('from')) : undefined,
    to: params.has('to') ? Number(params.get('to')) : undefined,
  })
  if (!time.success) return error(400, 'Invalid time range')
  const sortKey = v.safeParse(v.optional(RequestSortKeySchema), params.get('sortKey') ?? undefined)
  const sortDir = v.safeParse(v.optional(RequestSortDirSchema), params.get('sortDir') ?? undefined)
  if (!sortKey.success || !sortDir.success) return error(400, 'Invalid request sort')
  const sort = { sortKey: sortKey.output, sortDir: sortDir.output }
  if (
    cursor &&
    (cursor.length > 512 || (sort.sortKey ? !parseRequestCursor(cursor, sort) : !/^[a-zA-Z0-9_]+$/.test(cursor)))
  )
    return error(400, 'Invalid request cursor')
  const includeMcp = params.get('includeMcp') === 'true'
  const status = params.get('status')
  if (status !== null && status !== 'ok' && status !== 'err') return error(400, 'Invalid status filter')
  const routing = params.get('routing')
  if (routing !== null && routing !== 'routed' && routing !== 'unrouted') return error(400, 'Invalid routing filter')
  const models = params.getAll('model')
  const keys = params.getAll('key')
  const hosts = params.getAll('host')
  if ([models, keys, hosts].some((values) => values.length > 100 || values.some((value) => value.length > 1024)))
    return error(400, 'Invalid request filter')
  const textFilter = (name: string) => params.get(name) || undefined
  if (['q', 'client', 'endUser', 'session'].some((name) => (params.get(name)?.length ?? 0) > 1024))
    return error(400, 'Invalid request filter')
  const rawMinutes = params.get('minutes')
  const minutes = rawMinutes?.split(',').map(Number)
  if (
    rawMinutes != null &&
    (!/^\d+(,\d+)*$/.test(rawMinutes) ||
      !minutes ||
      minutes.length > 500 ||
      minutes.some((n) => !Number.isSafeInteger(n) || n < 0 || n % 60_000 !== 0 || n > 8_639_999_999_940_000))
  ) {
    return error(400, 'Invalid minute filter')
  }
  return {
    ...sort,
    ...time.output,
    ranges: ranges.output,
    cursor: cursor ?? undefined,
    includeMcp,
    minutes,
    status: status ?? undefined,
    routing: routing ?? undefined,
    models,
    keys,
    hosts,
    search: textFilter('q'),
    client: textFilter('client'),
    endUser: textFilter('endUser'),
    session: textFilter('session'),
  }
}
