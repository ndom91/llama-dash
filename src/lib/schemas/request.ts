import * as v from 'valibot'

export const ApiRequestSchema = v.object({
  id: v.string(),
  startedAt: v.string(),
  durationMs: v.number(),
  method: v.string(),
  endpoint: v.string(),
  model: v.nullable(v.string()),
  statusCode: v.number(),
  promptTokens: v.nullable(v.number()),
  completionTokens: v.nullable(v.number()),
  totalTokens: v.nullable(v.number()),
  cacheCreationTokens: v.nullable(v.number()),
  cacheReadTokens: v.nullable(v.number()),
  streamed: v.boolean(),
  error: v.nullable(v.string()),
  keyName: v.nullable(v.string()),
})

export type ApiRequest = v.InferOutput<typeof ApiRequestSchema>

export const ApiRequestDetailSchema = v.object({
  ...ApiRequestSchema.entries,
  requestHeaders: v.nullable(v.string()),
  requestBody: v.nullable(v.string()),
  responseHeaders: v.nullable(v.string()),
  responseBody: v.nullable(v.string()),
  streamCloseMs: v.nullable(v.number()),
})

export type ApiRequestDetail = v.InferOutput<typeof ApiRequestDetailSchema>

export const RequestsListResponseSchema = v.object({
  requests: v.array(ApiRequestSchema),
  nextCursor: v.nullable(v.string()),
})

export const RequestDetailResponseSchema = v.object({
  request: ApiRequestDetailSchema,
  prevId: v.nullable(v.string()),
  nextId: v.nullable(v.string()),
})

export const ApiRequestStatsSchema = v.object({
  reqPerSec: v.number(),
  tokPerSec: v.number(),
  p50Latency: v.number(),
  errorRate: v.number(),
  sparklines: v.object({
    reqs: v.array(v.number()),
    toks: v.array(v.number()),
    latency: v.array(v.number()),
    errors: v.array(v.number()),
  }),
})

export type ApiRequestStats = v.InferOutput<typeof ApiRequestStatsSchema>

export const ApiHistogramBucketSchema = v.object({
  timestamp: v.number(),
  total: v.number(),
  errors: v.number(),
})

export type ApiHistogramBucket = v.InferOutput<typeof ApiHistogramBucketSchema>

export const HistogramResponseSchema = v.object({
  buckets: v.array(ApiHistogramBucketSchema),
})
