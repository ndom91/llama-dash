import type { RequestInterval, RequestTimeFilter } from './schemas/request-search'
export type { RequestInterval, RequestTimeFilter, RequestTimeframe } from './schemas/request-search'

export const DEFAULT_REQUEST_TIMEFRAME = '3h'
export const REQUEST_TIMEFRAMES = [
  { value: '1h', label: 'Last 60 minutes' },
  { value: '3h', label: 'Last 3 hours' },
  { value: '24h', label: 'Last 24 hours' },
  { value: '7d', label: 'Last 7 days' },
  { value: 'all', label: 'All retained history' },
  { value: 'custom', label: 'Custom range' },
] as const
const WINDOWS = { '1h': 3_600_000, '3h': 10_800_000, '24h': 86_400_000, '7d': 604_800_000 }

export function requestTimeBounds(filter: RequestTimeFilter, now = Date.now()) {
  const preset = filter.timeframe ?? 'all'
  if (preset === 'all') return { from: undefined, to: undefined }
  if (preset === 'custom') return { from: filter.from, to: filter.to }
  return { from: now - WINDOWS[preset], to: now + 1 }
}

export function requestMatchesTimeframe(startedAt: string, filter: RequestTimeFilter, now = Date.now()) {
  const time = Date.parse(startedAt)
  const { from, to } = requestTimeBounds(filter, now)
  return (from === undefined || time >= from) && (to === undefined || time < to)
}

export function localDateTime(timestamp: number): string {
  const date = new Date(timestamp)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** Reject clock-change gaps and invalid dates instead of silently moving the range. */
export function parseLocalDateTime(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null
  const time = new Date(value).getTime()
  return Number.isFinite(time) && time >= 0 && localDateTime(time) === value ? time : null
}

export function mergeRequestIntervals(ranges: readonly RequestInterval[]): RequestInterval[] {
  const merged: RequestInterval[] = []
  for (const range of [...ranges].sort((a, b) => a.from - b.from)) {
    const last = merged.at(-1)
    if (last && range.from <= last.to) last.to = Math.max(last.to, range.to)
    else merged.push({ ...range })
  }
  return merged
}

export function requestMatchesIntervals(time: number, ranges: readonly RequestInterval[] = []) {
  return ranges.length === 0 || ranges.some((range) => time >= range.from && time < range.to)
}
