import { hasAnyUserKeys } from '../admin/api-keys.ts'
import {
  evaluateRoutingRules,
  listRoutingRules,
  type RoutingDecision,
  routingNeedsBody,
} from '../admin/routing-rules.ts'
import type { RoutingOutcome } from './transforms.ts'
import { estimatePromptTokens } from './tokens.ts'

// Resolve routing for a proxy request in a single ordered, first-match-wins pass
// using the optimistically-resolved API key. Rules are evaluated in the same
// order the UI presents them, so a require_key rule ordered above a passthrough
// rule wins when it matches.
export function resolveProxyRouting(
  endpoint: string,
  parsedBody: Record<string, unknown> | null,
  apiKeyId: string | null,
  headers: Headers,
): RoutingDecision {
  return evaluateRoutingRules(listRoutingRules(), {
    endpoint,
    requestedModel: parsedBody && typeof parsedBody.model === 'string' ? parsedBody.model : null,
    apiKeyId,
    stream: parsedBody?.stream === true,
    estimatedPromptTokens: parsedBody ? estimatePromptTokens(parsedBody) : null,
    headers,
  })
}

export function proxyRoutingNeedsBody(method: string, endpoint: string, apiKeyId: string | null): boolean {
  if (method === 'GET' || method === 'HEAD') return false
  // A non-null apiKeyId means a valid key was resolved. Only then (or when the
  // proxy runs open with no keys) may a require_key rule pull the body pre-auth.
  const includeRequireKeyRules = apiKeyId !== null || !hasAnyUserKeys()
  return routingNeedsBody(listRoutingRules(), endpoint, apiKeyId, includeRequireKeyRules)
}

export function shouldPreserveAuthorization(routing: RoutingOutcome): boolean {
  return routing.authMode === 'passthrough' && routing.preserveAuthorization
}
