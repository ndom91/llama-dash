import * as v from 'valibot'
import {
  LEGACY_DIRECT_UPSTREAM_HOSTS,
  PROVIDER_ENDPOINT_HOSTS,
  PROVIDER_PATH_JOINS,
  providerEndpointForBaseUrl,
} from '../providers.ts'

export const RoutingStreamModeSchema = v.picklist(['any', 'stream', 'non_stream'])
export type RoutingStreamMode = v.InferOutput<typeof RoutingStreamModeSchema>

export const RoutingAuthModeSchema = v.picklist(['require_key', 'passthrough'])
export type RoutingAuthMode = v.InferOutput<typeof RoutingAuthModeSchema>

export const CredentialBindingModeSchema = v.picklist(['replace_placeholder', 'set_header'])
export type CredentialBindingMode = v.InferOutput<typeof CredentialBindingModeSchema>

const NonEmptyStringArraySchema = v.array(v.pipe(v.string(), v.minLength(1), v.maxLength(200)))
const OptionalPositiveIntStringSchema = v.pipe(v.string(), v.regex(/^\d*$/))
const CHATGPT_CODEX_UPSTREAM_PATH = '/backend-api/codex'

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

export const ContinueActionSchema = v.object({
  type: v.literal('continue'),
})

export const RoutingActionSchema = v.variant('type', [
  RewriteModelActionSchema,
  RejectActionSchema,
  ContinueActionSchema,
])
export type RoutingAction = v.InferOutput<typeof RoutingActionSchema>

export const LlamaSwapTargetSchema = v.object({
  type: v.literal('llama_swap'),
})

export const DirectTargetSchema = v.pipe(
  v.object({
    type: v.literal('direct'),
    baseUrl: v.pipe(v.string(), v.url(), v.maxLength(500)),
    credentialId: v.optional(v.nullable(v.string())),
    // How the incoming proxy path is joined onto baseUrl. Defaults to the
    // legacy OpenAI-style join (base already carries the version segment).
    pathJoin: v.optional(v.picklist(PROVIDER_PATH_JOINS)),
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
        (isAllowedDirectUpstreamShape(target.baseUrl) ||
          (url.hostname.toLowerCase() === 'chatgpt.com' &&
            url.pathname.replace(/\/$/, '') === CHATGPT_CODEX_UPSTREAM_PATH))
      )
    } catch {
      return false
    }
  }, 'Direct upstream URL must use HTTPS, include no query or hash, and point at a supported provider endpoint'),
)

export const RoutingTargetSchema = v.variant('type', [LlamaSwapTargetSchema, DirectTargetSchema])
export type RoutingTarget = v.InferOutput<typeof RoutingTargetSchema>

export const HeaderNameSchema = v.pipe(v.string(), v.regex(/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/), v.maxLength(100))

export const CredentialBindingSchema = v.object({
  credentialId: v.pipe(v.string(), v.minLength(1), v.maxLength(120)),
  mode: CredentialBindingModeSchema,
  headerName: HeaderNameSchema,
  headerValueTemplate: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(1000))),
  /** How the credential is formatted in the header. Defaults to the credential type. */
  scheme: v.optional(v.picklist(['bearer', 'raw'])),
  required: v.optional(v.boolean()),
})
export type CredentialBinding = v.InferOutput<typeof CredentialBindingSchema>

export const ALLOWED_DIRECT_UPSTREAM_HOSTS = new Set([
  'api.openai.com',
  'api.anthropic.com',
  'chatgpt.com',
  ...PROVIDER_ENDPOINT_HOSTS,
])

export function isAllowedDirectUpstream(baseUrl: string): boolean {
  try {
    return ALLOWED_DIRECT_UPSTREAM_HOSTS.has(new URL(baseUrl).hostname.toLowerCase())
  } catch {
    return false
  }
}

/**
 * A direct upstream URL is well-formed when it points at a known provider
 * surface, or at a legacy OpenAI/Anthropic base that ends with `/v1`.
 */
export function isAllowedDirectUpstreamShape(baseUrl: string): boolean {
  try {
    const url = new URL(baseUrl)
    const path = url.pathname.replace(/\/$/, '')
    if (providerEndpointForBaseUrl(baseUrl)) return true
    if (!LEGACY_DIRECT_UPSTREAM_HOSTS.includes(url.hostname.toLowerCase() as never)) return false
    return path.endsWith('/v1')
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
  credentialBindings: v.optional(v.array(CredentialBindingSchema)),
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
  credentialBindings: v.optional(v.array(CredentialBindingSchema)),
})

export const CreateRoutingRuleBodySchema = v.pipe(
  CreateRoutingRuleBodyBaseSchema,
  v.check(
    (input) => isSafeRoutingRule(input),
    'Direct passthrough rules require at least one matcher and direct upstreams are currently limited to OpenAI, Anthropic, and ChatGPT',
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
  credentialBindings: v.optional(v.array(CredentialBindingSchema)),
})
export type UpdateRoutingRuleBody = v.InferOutput<typeof UpdateRoutingRuleBodySchema>

export const ReorderRoutingRulesBodySchema = v.object({
  ids: v.array(v.string()),
})
export type ReorderRoutingRulesBody = v.InferOutput<typeof ReorderRoutingRulesBodySchema>
