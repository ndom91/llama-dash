import * as v from 'valibot'

export const UpstreamCredentialTypeSchema = v.picklist(['bearer'])
export type UpstreamCredentialType = v.InferOutput<typeof UpstreamCredentialTypeSchema>

export const UpstreamCredentialSchema = v.object({
  id: v.string(),
  name: v.string(),
  type: UpstreamCredentialTypeSchema,
  createdAt: v.string(),
  updatedAt: v.string(),
  lastUsedAt: v.nullable(v.string()),
})
export type UpstreamCredential = v.InferOutput<typeof UpstreamCredentialSchema>

export const UpstreamCredentialListResponseSchema = v.object({
  credentials: v.array(UpstreamCredentialSchema),
  vaultEnabled: v.boolean(),
  vaultStatus: v.picklist(['ready', 'missing_key', 'key_too_short']),
})

export const CreateUpstreamCredentialBodySchema = v.object({
  name: v.pipe(v.string(), v.minLength(1), v.maxLength(200)),
  type: UpstreamCredentialTypeSchema,
  value: v.pipe(v.string(), v.minLength(1), v.maxLength(4000)),
})
export type CreateUpstreamCredentialBody = v.InferOutput<typeof CreateUpstreamCredentialBodySchema>

export const UpdateUpstreamCredentialBodySchema = v.object({
  name: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(200))),
  value: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(4000))),
})
export type UpdateUpstreamCredentialBody = v.InferOutput<typeof UpdateUpstreamCredentialBodySchema>
