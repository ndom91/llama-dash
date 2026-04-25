import * as v from 'valibot'

export const RoutingStreamModeSchema = v.picklist(['any', 'stream', 'non_stream'])
export type RoutingStreamMode = v.InferOutput<typeof RoutingStreamModeSchema>

export const RoutingAuthModeSchema = v.picklist(['require_key', 'passthrough'])
export type RoutingAuthMode = v.InferOutput<typeof RoutingAuthModeSchema>

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
export type RoutingMatchField = keyof RoutingMatch

export const ROUTING_MATCH_FIELD_METADATA: Record<RoutingMatchField, { requiresBodyForPreAuth: boolean }> = {
  endpoints: { requiresBodyForPreAuth: false },
  requestedModels: { requiresBodyForPreAuth: true },
  apiKeyIds: { requiresBodyForPreAuth: false },
  stream: { requiresBodyForPreAuth: true },
  minEstimatedPromptTokens: { requiresBodyForPreAuth: true },
  maxEstimatedPromptTokens: { requiresBodyForPreAuth: true },
}

export function hasAnyRoutingMatcher(match: RoutingMatch): boolean {
  return (
    match.endpoints.length > 0 ||
    match.requestedModels.length > 0 ||
    match.apiKeyIds.length > 0 ||
    match.stream !== 'any' ||
    match.minEstimatedPromptTokens !== '' ||
    match.maxEstimatedPromptTokens !== ''
  )
}

export const RewriteModelActionSchema = v.object({
  type: v.literal('rewrite_model'),
  model: v.pipe(v.string(), v.minLength(1), v.maxLength(200)),
})

export const RejectActionSchema = v.object({
  type: v.literal('reject'),
  reason: v.pipe(v.string(), v.minLength(1), v.maxLength(500)),
})

export const NoopActionSchema = v.object({
  type: v.literal('noop'),
})

export const RoutingActionSchema = v.variant('type', [RewriteModelActionSchema, RejectActionSchema, NoopActionSchema])
export type RoutingAction = v.InferOutput<typeof RoutingActionSchema>

export const LlamaSwapTargetSchema = v.object({
  type: v.literal('llama_swap'),
})

export const DirectTargetSchema = v.pipe(
  v.object({
    type: v.literal('direct'),
    baseUrl: v.pipe(v.string(), v.url(), v.maxLength(500)),
  }),
  v.check((target) => {
    try {
      const url = new URL(target.baseUrl)
      return (
        url.protocol === 'https:' &&
        !url.username &&
        !url.password &&
        !url.search &&
        !url.hash &&
        url.pathname.replace(/\/$/, '').endsWith('/v1')
      )
    } catch {
      return false
    }
  }, 'Direct upstream URL must use HTTPS, include no query or hash, and end with /v1'),
)

export const RoutingTargetSchema = v.variant('type', [LlamaSwapTargetSchema, DirectTargetSchema])
export type RoutingTarget = v.InferOutput<typeof RoutingTargetSchema>

export const ALLOWED_DIRECT_UPSTREAM_HOSTS = new Set(['api.openai.com', 'api.anthropic.com'])

export function isAllowedDirectUpstream(baseUrl: string): boolean {
  try {
    return ALLOWED_DIRECT_UPSTREAM_HOSTS.has(new URL(baseUrl).hostname.toLowerCase())
  } catch {
    return false
  }
}

type RoutingRuleSafetyInput = {
  match: RoutingMatch
  target?: RoutingTarget
  authMode?: RoutingAuthMode
}

function isSafeRoutingRule(input: RoutingRuleSafetyInput): boolean {
  const target = input.target ?? { type: 'llama_swap' }
  if (target.type === 'direct' && !isAllowedDirectUpstream(target.baseUrl)) return false
  if (target.type === 'direct' && input.authMode === 'passthrough') return hasAnyRoutingMatcher(input.match)
  return true
}

export const RoutingRuleSchema = v.object({
  id: v.string(),
  name: v.pipe(v.string(), v.minLength(1), v.maxLength(200)),
  enabled: v.boolean(),
  order: v.pipe(v.number(), v.integer(), v.minValue(1)),
  match: RoutingMatchSchema,
  action: RoutingActionSchema,
  target: RoutingTargetSchema,
  authMode: RoutingAuthModeSchema,
  preserveAuthorization: v.boolean(),
  createdAt: v.string(),
  updatedAt: v.string(),
})
export type RoutingRule = v.InferOutput<typeof RoutingRuleSchema>

export const RoutingRuleListResponseSchema = v.object({
  rules: v.array(RoutingRuleSchema),
})

const CreateRoutingRuleBodyBaseSchema = v.object({
  name: v.pipe(v.string(), v.minLength(1), v.maxLength(200)),
  enabled: v.boolean(),
  match: RoutingMatchSchema,
  action: RoutingActionSchema,
  target: v.optional(RoutingTargetSchema),
  authMode: v.optional(RoutingAuthModeSchema),
  preserveAuthorization: v.optional(v.boolean()),
})

export const CreateRoutingRuleBodySchema = v.pipe(
  CreateRoutingRuleBodyBaseSchema,
  v.check(
    (input) => isSafeRoutingRule(input),
    'Direct passthrough rules require at least one matcher and direct upstreams are currently limited to OpenAI and Anthropic',
  ),
)
export type CreateRoutingRuleBody = v.InferOutput<typeof CreateRoutingRuleBodyBaseSchema>

export const UpdateRoutingRuleBodySchema = v.object({
  name: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(200))),
  enabled: v.optional(v.boolean()),
  match: v.optional(RoutingMatchSchema),
  action: v.optional(RoutingActionSchema),
  target: v.optional(RoutingTargetSchema),
  authMode: v.optional(RoutingAuthModeSchema),
  preserveAuthorization: v.optional(v.boolean()),
})
export type UpdateRoutingRuleBody = v.InferOutput<typeof UpdateRoutingRuleBodySchema>

export const ReorderRoutingRulesBodySchema = v.object({
  ids: v.array(v.string()),
})
export type ReorderRoutingRulesBody = v.InferOutput<typeof ReorderRoutingRulesBodySchema>
