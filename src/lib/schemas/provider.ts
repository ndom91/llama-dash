import * as v from 'valibot'

/**
 * A provider target the operator has connected.
 *
 * One connection = one subscription entry point (provider + plan + region) =
 * one API key. Connecting wires every API surface of that target (OpenAI,
 * Anthropic, Responses) at once. Models are auto-discovered from the provider
 * and stored with the connection — never hardcoded.
 */
export const ProviderConnectionSchema = v.object({
  id: v.string(),
  targetId: v.string(),
  targetLabel: v.string(),
  credentialId: v.string(),
  credentialName: v.string(),
  routingRuleIds: v.array(v.string()),
  /** Auto-discovered from the provider's `/v1/models` listing. */
  models: v.array(v.string()),
  modelsDiscoveredAt: v.nullable(v.string()),
  enabled: v.boolean(),
  createdAt: v.string(),
  updatedAt: v.string(),
})
export type ProviderConnection = v.InferOutput<typeof ProviderConnectionSchema>

export const ProviderConnectionListResponseSchema = v.object({
  connections: v.array(ProviderConnectionSchema),
})

export const ConnectProviderBodySchema = v.object({
  targetId: v.pipe(v.string(), v.minLength(1), v.maxLength(120)),
  apiKey: v.pipe(v.string(), v.minLength(1), v.maxLength(4000)),
  name: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(200))),
})
export type ConnectProviderBody = v.InferOutput<typeof ConnectProviderBodySchema>

export const ProviderTargetBodySchema = v.object({
  targetId: v.pipe(v.string(), v.minLength(1), v.maxLength(120)),
})
export type ProviderTargetBody = v.InferOutput<typeof ProviderTargetBodySchema>

export const TestProviderBodySchema = v.object({
  targetId: v.pipe(v.string(), v.minLength(1), v.maxLength(120)),
  /** Optional ad-hoc key; falls back to the stored credential. */
  apiKey: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(4000))),
})
export type TestProviderBody = v.InferOutput<typeof TestProviderBodySchema>

export const ProviderTestResultSchema = v.object({
  ok: v.boolean(),
  status: v.number(),
  latencyMs: v.number(),
  message: v.string(),
  /** Models discovered during the probe. */
  models: v.array(v.string()),
})
export type ProviderTestResult = v.InferOutput<typeof ProviderTestResultSchema>
