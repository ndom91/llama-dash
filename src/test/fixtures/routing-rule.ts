import type { RoutingMatch, RoutingRule } from '../../lib/schemas/routing-rule.ts'

export function emptyRoutingMatch(overrides: Partial<RoutingMatch> = {}): RoutingMatch {
  return {
    endpoints: [],
    requestedModels: [],
    apiKeyIds: [],
    stream: 'any',
    minEstimatedPromptTokens: '',
    maxEstimatedPromptTokens: '',
    ...overrides,
  }
}

/** In-memory RoutingRule shape for unit tests that mock listRoutingRules. */
export function makeRoutingRule(overrides: Partial<RoutingRule> = {}): RoutingRule {
  return {
    id: 'rrl_test',
    name: 'Test rule',
    enabled: true,
    order: 1,
    match: emptyRoutingMatch(),
    action: { type: 'continue' },
    target: { type: 'llama_swap' },
    authMode: 'require_key',
    preserveAuthorization: false,
    credentialBindings: [],
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
    ...overrides,
  }
}
