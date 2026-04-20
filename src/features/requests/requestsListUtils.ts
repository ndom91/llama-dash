import type { ApiRequest } from '../../lib/api'

export const REQUESTS_ROW_HEIGHT = 37
export const REQUESTS_COL_WIDTHS = [100, '22%', '28%', 70, 80, 80, 110] as const

export type SortKey = 'startedAt' | 'durationMs' | 'statusCode' | 'totalTokens'
export type SortDir = 'asc' | 'desc'
export type StatusFilter = 'all' | 'ok' | 'err'

export function sortVal(r: ApiRequest, key: SortKey): number | string {
  switch (key) {
    case 'startedAt':
      return r.startedAt
    case 'durationMs':
      return r.durationMs
    case 'statusCode':
      return r.statusCode
    case 'totalTokens':
      return r.totalTokens ?? 0
  }
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
    hour12: false,
  })
}
