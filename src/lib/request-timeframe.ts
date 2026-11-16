import * as v from 'valibot'

export const REQUEST_TIMEFRAMES = [
  { value: 'all', label: 'All retained history' },
  { value: '1h', label: 'Last 60 minutes' },
  { value: '3h', label: 'Last 3 hours' },
  { value: '24h', label: 'Last 24 hours' },
  { value: '7d', label: 'Last 7 days' },
  { value: 'custom', label: 'Custom range' },
] as const
export const RequestTimeframeSchema = v.picklist(['all', '1h', '3h', '24h', '7d', 'custom'])
export type RequestTimeframe = v.InferOutput<typeof RequestTimeframeSchema>
export type RequestTimeFilter = { timeframe?: RequestTimeframe; from?: number; to?: number }
const WINDOWS = { '1h': 3_600_000, '3h': 10_800_000, '24h': 86_400_000, '7d': 604_800_000 }
export const RequestTimeFilterSchema = v.pipe(
  v.object({
    timeframe: v.optional(RequestTimeframeSchema),
    from: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(8_639_999_999_999_999))),
    to: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(8_640_000_000_000_000))),
  }),
  v.check(
    (value) =>
      value.timeframe === 'custom'
        ? value.from !== undefined && value.to !== undefined && value.from < value.to
        : value.from === undefined && value.to === undefined,
    'Invalid time range',
  ),
)

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
