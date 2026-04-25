import { resolveAlias } from '../admin/model-aliases.ts'
import { evaluateRoutingRules, listRoutingRules } from '../admin/routing-rules.ts'
import { getRequestLimits } from '../admin/settings.ts'
import type { ApiKey } from '../db/schema.ts'

export type TransformContext = {
  keyRow: ApiKey | null
  endpoint: string
  method: string
  skipRouting: boolean
  headers?: Headers
}

export type RoutingOutcome = {
  ruleId: string | null
  ruleName: string | null
  actionType: 'rewrite_model' | 'reject' | 'noop' | null
  authMode: 'require_key' | 'passthrough' | null
  preserveAuthorization: boolean
  targetType: 'llama_swap' | 'direct' | null
  targetBaseUrl: string | null
  requestedModel: string | null
  routedModel: string | null
  rejectReason: string | null
}

export const EMPTY_ROUTING_OUTCOME: RoutingOutcome = {
  ruleId: null,
  ruleName: null,
  actionType: null,
  authMode: null,
  preserveAuthorization: false,
  targetType: null,
  targetBaseUrl: null,
  requestedModel: null,
  routedModel: null,
  rejectReason: null,
}

type TransformOk = { ok: true; body: Record<string, unknown> | null; mutated: boolean; routing: RoutingOutcome }
type TransformErr = {
  ok: false
  status: number
  body: { error: { message: string; type: string } }
  routing: RoutingOutcome
}
export type TransformResult = TransformOk | TransformErr

export function applyTransforms(parsedBody: Record<string, unknown> | null, ctx: TransformContext): TransformResult {
  if (!parsedBody) {
    return { ok: true, body: parsedBody, mutated: false, routing: emptyRoutingOutcome() }
  }

  let mutated = false

  // Step 3: Model allow-list check before routing rewrites.
  const allowErrBeforeRouting = checkModelAllowed(ctx.keyRow, parsedBody, emptyRoutingOutcome())
  if (allowErrBeforeRouting) return allowErrBeforeRouting

  const routingDecision = ctx.skipRouting
    ? {
        matchedRule: null,
        action: null,
        target: { type: 'llama_swap' as const },
        authMode: 'require_key' as const,
        preserveAuthorization: false as const,
      }
    : evaluateRoutingRules(listRoutingRules(), {
        endpoint: ctx.endpoint,
        requestedModel: typeof parsedBody.model === 'string' ? parsedBody.model : null,
        apiKeyId: ctx.keyRow?.id ?? null,
        stream: parsedBody.stream === true,
        estimatedPromptTokens: estimatePromptTokens(parsedBody),
        headers: ctx.headers,
      })
  const routing = routingOutcomeFromDecision(
    routingDecision,
    typeof parsedBody.model === 'string' ? parsedBody.model : null,
  )

  if (routingDecision.action?.type === 'reject') {
    return {
      ok: false,
      status: 422,
      body: {
        error: {
          message: routingDecision.action.reason,
          type: 'routing_rule_rejected',
        },
      },
      routing,
    }
  }

  if (routingDecision.action?.type === 'rewrite_model') {
    parsedBody.model = routingDecision.action.model
    mutated = true
  }

  // Step 4: Model allow-list check again after routing rewrites.
  const allowErr = checkModelAllowed(ctx.keyRow, parsedBody, routing)
  if (allowErr) return allowErr

  // Step 5: Alias resolution
  if (typeof parsedBody.model === 'string') {
    const resolved = resolveAlias(parsedBody.model)
    if (resolved !== parsedBody.model) {
      parsedBody.model = resolved
      mutated = true
    }
  }

  // Step 6: System prompt injection
  if (ctx.keyRow?.systemPrompt) {
    if (ctx.endpoint === '/v1/chat/completions' && Array.isArray(parsedBody.messages)) {
      parsedBody.messages = [{ role: 'system', content: ctx.keyRow.systemPrompt }, ...parsedBody.messages]
      mutated = true
    } else if (ctx.endpoint === '/v1/messages') {
      parsedBody.system = injectAnthropicSystem(parsedBody.system, ctx.keyRow.systemPrompt)
      mutated = true
    }
  }

  // Step 7: Request size limits (checks run after system prompt injection)
  const limitsErr = checkRequestLimits(parsedBody, routing)
  if (limitsErr) return limitsErr

  return { ok: true, body: parsedBody, mutated, routing }
}

export function emptyRoutingOutcome(): RoutingOutcome {
  return { ...EMPTY_ROUTING_OUTCOME }
}

export function routingOutcomeFromDecision(
  decision: ReturnType<typeof evaluateRoutingRules>,
  requestedModel: string | null,
): RoutingOutcome {
  if (!decision.matchedRule) return emptyRoutingOutcome()
  return {
    ruleId: decision.matchedRule.id,
    ruleName: decision.matchedRule.name,
    actionType: decision.action?.type ?? null,
    authMode: decision.authMode,
    preserveAuthorization: decision.authMode === 'passthrough' && decision.preserveAuthorization,
    targetType: decision.target.type,
    targetBaseUrl: decision.target.type === 'direct' ? decision.target.baseUrl : null,
    requestedModel,
    routedModel: decision.action?.type === 'rewrite_model' ? decision.action.model : null,
    rejectReason: decision.action?.type === 'reject' ? decision.action.reason : null,
  }
}

function estimatePromptTokens(body: Record<string, unknown>): number | null {
  const parts: Array<unknown> = []
  if (Array.isArray(body.messages)) parts.push(body.messages)
  if (body.system != null) parts.push(body.system)
  if (Array.isArray(body.tools)) parts.push(body.tools)
  if (parts.length === 0) return null
  return Math.ceil(JSON.stringify(parts).length / 4)
}

// Anthropic's /v1/messages `system` field accepts either a string or an array of
// content blocks. Prepend ours while preserving whatever the caller sent.
function injectAnthropicSystem(existing: unknown, injected: string): unknown {
  if (existing == null || existing === '') return injected
  if (typeof existing === 'string') return `${injected}\n\n${existing}`
  if (Array.isArray(existing)) return [{ type: 'text', text: injected }, ...existing]
  return injected
}

function checkRequestLimits(body: Record<string, unknown>, routing: RoutingOutcome): TransformErr | null {
  const limits = getRequestLimits()
  if (!limits.maxMessages && !limits.maxEstimatedTokens) return null

  if (limits.maxMessages && Array.isArray(body.messages)) {
    if (body.messages.length > limits.maxMessages) {
      return {
        ok: false,
        status: 422,
        body: {
          error: {
            message: `Request has ${body.messages.length} messages, exceeding the limit of ${limits.maxMessages}`,
            type: 'request_too_large',
          },
        },
        routing,
      }
    }
  }

  if (limits.maxEstimatedTokens) {
    // Count everything the model sees on input: OpenAI `messages`, Anthropic
    // top-level `system` and `tools`. Size limits were previously bypassable
    // with a giant system prompt or tool definition.
    const parts: Array<unknown> = []
    if (Array.isArray(body.messages)) parts.push(body.messages)
    if (body.system != null) parts.push(body.system)
    if (Array.isArray(body.tools)) parts.push(body.tools)
    if (parts.length > 0) {
      const estimated = Math.ceil(JSON.stringify(parts).length / 4)
      if (estimated > limits.maxEstimatedTokens) {
        return {
          ok: false,
          status: 422,
          body: {
            error: {
              message: `Estimated prompt tokens (~${estimated}) exceeds the limit of ${limits.maxEstimatedTokens}`,
              type: 'request_too_large',
            },
          },
          routing,
        }
      }
    }
  }

  return null
}

export function checkModelAllowed(
  keyRow: ApiKey | null,
  body: Record<string, unknown>,
  routing: RoutingOutcome,
): TransformErr | null {
  if (!keyRow) return null

  const allowedModels: Array<string> = JSON.parse(keyRow.allowedModels)
  if (allowedModels.length === 0) return null

  const model = typeof body.model === 'string' ? body.model : null
  if (!model) return null
  if (allowedModels.includes(model)) return null

  return {
    ok: false,
    status: 403,
    body: {
      error: {
        message: `Model '${model}' is not allowed for this API key`,
        type: 'model_not_allowed',
      },
    },
    routing,
  }
}
