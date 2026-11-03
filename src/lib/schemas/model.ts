import * as v from 'valibot'
import { ApiRequestSchema } from './request'

export const ApiModelCapabilitiesSchema = v.object({
  inputModalities: v.array(v.string()),
  outputModalities: v.array(v.string()),
  flags: v.array(v.string()),
  supportedParameters: v.array(v.string()),
})

export type ApiModelCapabilities = v.InferOutput<typeof ApiModelCapabilitiesSchema>

export const ApiModelSelectorSchema = v.object({
  strategy: v.string(),
  targets: v.array(v.string()),
  spillover: v.nullable(v.number()),
})

export type ApiModelSelector = v.InferOutput<typeof ApiModelSelectorSchema>

export const ApiModelSchema = v.object({
  id: v.string(),
  name: v.string(),
  kind: v.union([v.literal('local'), v.literal('peer'), v.literal('selector')]),
  peerId: v.nullable(v.string()),
  peerHost: v.nullable(v.string()),
  selector: v.nullable(ApiModelSelectorSchema),
  contextLength: v.nullable(v.number()),
  state: v.string(),
  running: v.boolean(),
  ttl: v.nullable(v.number()),
  capabilities: ApiModelCapabilitiesSchema,
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

export const ModelActivityTickSchema = v.object({
  bucket: v.number(),
  count: v.number(),
  errors: v.number(),
})

export type ApiModelActivityTick = v.InferOutput<typeof ModelActivityTickSchema>

export const ModelActivityEntrySchema = v.object({
  model: v.string(),
  total: v.number(),
  errors: v.number(),
  lastAt: v.nullable(v.number()),
  ticks: v.array(ModelActivityTickSchema),
})

export type ApiModelActivityEntry = v.InferOutput<typeof ModelActivityEntrySchema>

export const ModelActivityResponseSchema = v.object({
  windowMs: v.number(),
  bucketMs: v.number(),
  /** Window start in epoch ms; bucket `n` covers `[since + n·bucketMs, since + (n+1)·bucketMs)`. */
  since: v.number(),
  models: v.array(ModelActivityEntrySchema),
})

export type ApiModelActivity = v.InferOutput<typeof ModelActivityResponseSchema>

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
