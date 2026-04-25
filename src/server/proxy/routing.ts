import {
  evaluatePreAuthRoutingRules,
  hasBodyDependentPreAuthRoutingRule,
  listRoutingRules,
} from '../admin/routing-rules.ts'
import { routingOutcomeFromDecision, type RoutingOutcome } from './transforms.ts'
import { estimatePromptTokens } from './tokens.ts'

export function evaluatePreAuthRouting(
  endpoint: string,
  parsedBody: Record<string, unknown> | null,
  headers: Headers,
): RoutingOutcome {
  const decision = evaluatePreAuthRoutingRules(listRoutingRules(), {
    endpoint,
    requestedModel: parsedBody && typeof parsedBody.model === 'string' ? parsedBody.model : null,
    stream: parsedBody?.stream === true,
    estimatedPromptTokens: parsedBody ? estimatePromptTokens(parsedBody) : null,
    headers,
  })
  return routingOutcomeFromDecision(
    decision,
    parsedBody && typeof parsedBody.model === 'string' ? parsedBody.model : null,
  )
}

export function preAuthRoutingNeedsBody(method: string): boolean {
  if (method === 'GET' || method === 'HEAD') return false
  return hasBodyDependentPreAuthRoutingRule(listRoutingRules())
}

export function shouldPreserveAuthorization(routing: RoutingOutcome): boolean {
  return routing.authMode === 'passthrough' && routing.preserveAuthorization
}

function hasRoutingMatch(routing: RoutingOutcome): boolean {
  return routing.targetType !== null
}

export function preferPostAuthRouting(preAuthRouting: RoutingOutcome, postAuthRouting: RoutingOutcome): RoutingOutcome {
  return hasRoutingMatch(postAuthRouting) || !hasRoutingMatch(preAuthRouting) ? postAuthRouting : preAuthRouting
}
