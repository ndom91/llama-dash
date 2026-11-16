import * as v from 'valibot'
import { RequestCursorSchema, type RequestSort, type SortKey } from './schemas/request-search'
export type { RequestSort, SortKey, SortDir } from './schemas/request-search'
import type { ApiRequest } from './schemas/request'

export function requestSortValue(row: ApiRequest, key: SortKey): number {
  return key === 'startedAt' ? Date.parse(row.startedAt) : (row[key] ?? 0)
}

export function requestCursor(row: ApiRequest, sort: RequestSort = {}): string {
  if (!sort.sortKey) return row.id
  return JSON.stringify([sort.sortKey, sort.sortDir ?? 'desc', requestSortValue(row, sort.sortKey), row.id])
}

export function parseRequestCursor(cursor: string, sort: RequestSort) {
  try {
    const [key, dir, value, id] = v.parse(RequestCursorSchema, JSON.parse(cursor))
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
