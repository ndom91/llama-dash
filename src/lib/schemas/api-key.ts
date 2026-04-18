import * as v from 'valibot'

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
