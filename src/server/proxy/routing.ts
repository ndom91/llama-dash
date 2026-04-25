import { evaluatePreAuthRoutingRules, listRoutingRules } from '../admin/routing-rules.ts'
import type { AuthOkResult } from './auth.ts'
import { routingOutcomeFromDecision, type RoutingOutcome } from './transforms.ts'

export function evaluateBodylessPreAuthRouting(endpoint: string, headers: Headers): RoutingOutcome {
  const decision = evaluatePreAuthRoutingRules(listRoutingRules(), {
    endpoint,
    requestedModel: null,
    stream: false,
    estimatedPromptTokens: null,
    headers,
  })
  return routingOutcomeFromDecision(decision, null)
}

export function shouldPreserveAuthorization(auth: AuthOkResult, routing: RoutingOutcome): boolean {
  const passthrough = auth.passthrough || routing.authMode === 'passthrough'
  if (!passthrough) return false
  return auth.preserveAuthorization || routing.preserveAuthorization
}
