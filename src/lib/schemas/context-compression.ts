import * as v from 'valibot'

const StringList = v.array(v.pipe(v.string(), v.minLength(1), v.maxLength(200)))
const OptionalPositiveIntString = v.pipe(v.string(), v.regex(/^\d*$/))

export const ContextCompressionMatchSchema = v.object({
  endpoints: StringList,
  effectiveModels: StringList,
  apiKeyIds: StringList,
  stream: v.picklist(['any', 'stream', 'non_stream']),
  minEstimatedPromptTokens: OptionalPositiveIntString,
  maxEstimatedPromptTokens: OptionalPositiveIntString,
})
export type ContextCompressionMatch = v.InferOutput<typeof ContextCompressionMatchSchema>

export const ContextCompressionPolicySchema = v.object({
  id: v.string(),
  name: v.pipe(v.string(), v.minLength(1), v.maxLength(200)),
  enabled: v.boolean(),
  order: v.pipe(v.number(), v.integer(), v.minValue(1)),
  match: ContextCompressionMatchSchema,
  createdAt: v.string(),
  updatedAt: v.string(),
})
export type ContextCompressionPolicy = v.InferOutput<typeof ContextCompressionPolicySchema>

export const ContextCompressionPolicyListResponseSchema = v.object({ rules: v.array(ContextCompressionPolicySchema) })
export const CreateContextCompressionPolicyBodySchema = v.object({
  name: v.pipe(v.string(), v.minLength(1), v.maxLength(200)),
  enabled: v.boolean(),
  match: ContextCompressionMatchSchema,
})
export type CreateContextCompressionPolicyBody = v.InferOutput<typeof CreateContextCompressionPolicyBodySchema>
export const UpdateContextCompressionPolicyBodySchema = v.object({
  name: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(200))),
  enabled: v.optional(v.boolean()),
  match: v.optional(ContextCompressionMatchSchema),
})
export type UpdateContextCompressionPolicyBody = v.InferOutput<typeof UpdateContextCompressionPolicyBodySchema>
export const ReorderContextCompressionPoliciesBodySchema = v.object({ ids: v.array(v.string()) })
