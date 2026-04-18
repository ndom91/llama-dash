import * as v from 'valibot'
import { ApiRequestSchema } from './request'

export const ApiModelSchema = v.object({
  id: v.string(),
  name: v.string(),
  kind: v.union([v.literal('local'), v.literal('peer')]),
  peerId: v.nullable(v.string()),
  state: v.string(),
  running: v.boolean(),
  ttl: v.nullable(v.number()),
})

export type ApiModel = v.InferOutput<typeof ApiModelSchema>

export const ApiModelEventSchema = v.object({
  id: v.string(),
  modelId: v.string(),
  event: v.union([v.literal('load'), v.literal('unload')]),
  timestamp: v.string(),
})

export type ApiModelEvent = v.InferOutput<typeof ApiModelEventSchema>

export const ModelsResponseSchema = v.object({
  models: v.array(ApiModelSchema),
})

export const ModelTimelineResponseSchema = v.object({
  events: v.array(ApiModelEventSchema),
})

export const ModelStatsSchema = v.object({
  totalRequests: v.number(),
  errorCount: v.number(),
  errorRate: v.number(),
  avgDurationMs: v.number(),
  avgTokPerSec: v.number(),
  totalPromptTokens: v.number(),
  totalCompletionTokens: v.number(),
  sparklines: v.object({
    reqs: v.array(v.number()),
    toks: v.array(v.number()),
  }),
})

export type ApiModelStats = v.InferOutput<typeof ModelStatsSchema>

export const ModelKeyBreakdownSchema = v.object({
  keyId: v.nullable(v.string()),
  keyName: v.nullable(v.string()),
  requestCount: v.number(),
  totalTokens: v.number(),
  errorCount: v.number(),
})

export type ApiModelKeyBreakdown = v.InferOutput<typeof ModelKeyBreakdownSchema>

export const ModelDetailResponseSchema = v.object({
  model: ApiModelSchema,
  events: v.array(ApiModelEventSchema),
  stats: ModelStatsSchema,
  requests: v.object({
    rows: v.array(ApiRequestSchema),
    nextCursor: v.nullable(v.string()),
  }),
  configSnippet: v.nullable(v.string()),
  keyBreakdown: v.array(ModelKeyBreakdownSchema),
})

export type ApiModelDetail = v.InferOutput<typeof ModelDetailResponseSchema>
