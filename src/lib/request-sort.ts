import * as v from 'valibot'
import type { ApiRequest } from './schemas/request'

export const RequestSortKeySchema = v.picklist(['startedAt', 'durationMs', 'statusCode', 'totalTokens'])
export const RequestSortDirSchema = v.picklist(['asc', 'desc'])
export type SortKey = v.InferOutput<typeof RequestSortKeySchema>
export type SortDir = v.InferOutput<typeof RequestSortDirSchema>
export type RequestSort = { sortKey?: SortKey; sortDir?: SortDir }

const CursorSchema = v.tuple([
  RequestSortKeySchema,
  RequestSortDirSchema,
  v.pipe(v.number(), v.finite()),
  v.pipe(v.string(), v.regex(/^[a-zA-Z0-9_]+$/)),
])

export function requestSortValue(row: ApiRequest, key: SortKey): number {
  return key === 'startedAt' ? Date.parse(row.startedAt) : (row[key] ?? 0)
}

export function requestCursor(row: ApiRequest, sort: RequestSort = {}): string {
  if (!sort.sortKey) return row.id
  return JSON.stringify([sort.sortKey, sort.sortDir ?? 'desc', requestSortValue(row, sort.sortKey), row.id])
}

export function parseRequestCursor(cursor: string, sort: RequestSort) {
  try {
    const [key, dir, value, id] = v.parse(CursorSchema, JSON.parse(cursor))
    return key === sort.sortKey && dir === (sort.sortDir ?? 'desc') ? { value, id } : null
  } catch {
    return null
  }
}

export function compareRequests(a: ApiRequest, b: ApiRequest, sort: RequestSort = {}): number {
  const value = sort.sortKey ? requestSortValue(a, sort.sortKey) - requestSortValue(b, sort.sortKey) : 0
  const tie = a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  return (value || tie) * (sort.sortDir === 'asc' ? 1 : -1)
}
