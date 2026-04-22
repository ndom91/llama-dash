import * as v from 'valibot'

export const RoutingStreamModeSchema = v.picklist(['any', 'stream', 'non_stream'])
export type RoutingStreamMode = v.InferOutput<typeof RoutingStreamModeSchema>

const NonEmptyStringArraySchema = v.array(v.pipe(v.string(), v.minLength(1), v.maxLength(200)))
const OptionalPositiveIntStringSchema = v.pipe(v.string(), v.regex(/^\d*$/))

export const RoutingMatchSchema = v.object({
  endpoints: NonEmptyStringArraySchema,
  requestedModels: NonEmptyStringArraySchema,
  apiKeyIds: NonEmptyStringArraySchema,
  stream: RoutingStreamModeSchema,
  minEstimatedPromptTokens: OptionalPositiveIntStringSchema,
  maxEstimatedPromptTokens: OptionalPositiveIntStringSchema,
})
export type RoutingMatch = v.InferOutput<typeof RoutingMatchSchema>

export const RewriteModelActionSchema = v.object({
  type: v.literal('rewrite_model'),
  model: v.pipe(v.string(), v.minLength(1), v.maxLength(200)),
})

export const RejectActionSchema = v.object({
  type: v.literal('reject'),
  reason: v.pipe(v.string(), v.minLength(1), v.maxLength(500)),
})

export const RoutingActionSchema = v.variant('type', [RewriteModelActionSchema, RejectActionSchema])
export type RoutingAction = v.InferOutput<typeof RoutingActionSchema>

export const RoutingRuleSchema = v.object({
  id: v.string(),
  name: v.pipe(v.string(), v.minLength(1), v.maxLength(200)),
  enabled: v.boolean(),
  order: v.pipe(v.number(), v.integer(), v.minValue(1)),
  match: RoutingMatchSchema,
  action: RoutingActionSchema,
  createdAt: v.string(),
  updatedAt: v.string(),
})
export type RoutingRule = v.InferOutput<typeof RoutingRuleSchema>

export const RoutingRuleListResponseSchema = v.object({
  rules: v.array(RoutingRuleSchema),
})

export const CreateRoutingRuleBodySchema = v.object({
  name: v.pipe(v.string(), v.minLength(1), v.maxLength(200)),
  enabled: v.boolean(),
  match: RoutingMatchSchema,
  action: RoutingActionSchema,
})
export type CreateRoutingRuleBody = v.InferOutput<typeof CreateRoutingRuleBodySchema>

export const UpdateRoutingRuleBodySchema = v.object({
  name: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(200))),
  enabled: v.optional(v.boolean()),
  match: v.optional(RoutingMatchSchema),
  action: v.optional(RoutingActionSchema),
})
export type UpdateRoutingRuleBody = v.InferOutput<typeof UpdateRoutingRuleBodySchema>

export const ReorderRoutingRulesBodySchema = v.object({
  ids: v.array(v.string()),
})
export type ReorderRoutingRulesBody = v.InferOutput<typeof ReorderRoutingRulesBodySchema>
