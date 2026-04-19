import * as v from 'valibot'
import { ApiRequestSchema } from './request'

export const ApiKeySchema = v.object({
  id: v.string(),
  name: v.string(),
  keyPrefix: v.string(),
  createdAt: v.string(),
  disabledAt: v.nullable(v.string()),
  allowedModels: v.array(v.string()),
  rateLimitRpm: v.nullable(v.number()),
  rateLimitTpm: v.nullable(v.number()),
  monthlyTokenQuota: v.nullable(v.number()),
})

export type ApiKeyItem = v.InferOutput<typeof ApiKeySchema>

export const ApiKeyListResponseSchema = v.object({
  keys: v.array(ApiKeySchema),
})

export const ApiKeyCreatedSchema = v.object({
  key: ApiKeySchema,
  rawKey: v.string(),
})

export type ApiKeyCreated = v.InferOutput<typeof ApiKeyCreatedSchema>

export const CreateApiKeyBodySchema = v.object({
  name: v.pipe(v.string(), v.minLength(1), v.maxLength(100)),
  allowedModels: v.optional(v.array(v.string()), []),
  rateLimitRpm: v.optional(v.nullable(v.number())),
  rateLimitTpm: v.optional(v.nullable(v.number())),
  monthlyTokenQuota: v.optional(v.nullable(v.number())),
})

export type CreateApiKeyBody = v.InferOutput<typeof CreateApiKeyBodySchema>

export const UpdateApiKeyBodySchema = v.object({
  name: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(100))),
  allowedModels: v.optional(v.array(v.string())),
})

export type UpdateApiKeyBody = v.InferOutput<typeof UpdateApiKeyBodySchema>

export const KeyStatsSchema = v.object({
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

export type ApiKeyStats = v.InferOutput<typeof KeyStatsSchema>

export const KeyModelBreakdownSchema = v.object({
  model: v.nullable(v.string()),
  requestCount: v.number(),
  totalTokens: v.number(),
  errorCount: v.number(),
})

export type ApiKeyModelBreakdown = v.InferOutput<typeof KeyModelBreakdownSchema>

export const KeyDetailResponseSchema = v.object({
  key: ApiKeySchema,
  stats: KeyStatsSchema,
  requests: v.object({
    rows: v.array(ApiRequestSchema),
    nextCursor: v.nullable(v.string()),
  }),
  modelBreakdown: v.array(KeyModelBreakdownSchema),
})

export type ApiKeyDetail = v.InferOutput<typeof KeyDetailResponseSchema>
