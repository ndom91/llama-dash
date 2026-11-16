import * as v from 'valibot'

export const RequestSortKeySchema = v.picklist(['startedAt', 'durationMs', 'statusCode', 'totalTokens'])
export const RequestSortDirSchema = v.picklist(['asc', 'desc'])
export type SortKey = v.InferOutput<typeof RequestSortKeySchema>
export type SortDir = v.InferOutput<typeof RequestSortDirSchema>
export const RequestSortSchema = v.object({
  sortKey: v.optional(RequestSortKeySchema),
  sortDir: v.optional(RequestSortDirSchema),
})
export type RequestSort = v.InferOutput<typeof RequestSortSchema>

export const RequestCursorSchema = v.tuple([
  RequestSortKeySchema,
  RequestSortDirSchema,
  v.pipe(v.number(), v.finite()),
  v.pipe(v.string(), v.regex(/^[a-zA-Z0-9_]+$/)),
])

export const RequestTimeframeSchema = v.picklist([
  'all',
  '15m',
  '1h',
  '3h',
  '24h',
  '7d',
  '30d',
  'today',
  'yesterday',
  'custom',
])
export type RequestTimeframe = v.InferOutput<typeof RequestTimeframeSchema>
export type RequestTimeFilter = v.InferOutput<typeof RequestTimeFilterSchema>
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

export const RequestIntervalSchema = v.pipe(
  v.object({
    from: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(8_639_999_999_999_999)),
    to: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(8_640_000_000_000_000)),
  }),
  v.check((range) => range.from < range.to, 'Invalid interval'),
)
export const RequestIntervalsSchema = v.pipe(v.array(RequestIntervalSchema), v.maxLength(240))
export type RequestInterval = v.InferOutput<typeof RequestIntervalSchema>
