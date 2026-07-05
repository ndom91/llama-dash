import { describe, expect, it, vi } from 'vitest'
import type { RoutingRule } from '../../lib/schemas/routing-rule'
import { emptyRoutingOutcome, type RoutingOutcome } from './transforms'

const routingRulesMock = vi.hoisted(() => ({
  listRoutingRules: vi.fn<() => RoutingRule[]>(() => []),
}))
const apiKeysMock = vi.hoisted(() => ({
  hasAnyUserKeys: vi.fn(() => true),
}))

vi.mock('../admin/routing-rules.ts', async () => {
  const actual = await vi.importActual<typeof import('../admin/routing-rules.ts')>('../admin/routing-rules.ts')
  return { ...actual, listRoutingRules: routingRulesMock.listRoutingRules }
})

vi.mock('../admin/api-keys.ts', () => ({
  hasAnyUserKeys: apiKeysMock.hasAnyUserKeys,
}))

import { proxyRoutingNeedsBody, resolveProxyRouting, shouldPreserveAuthorization } from './routing'

function outcome(overrides: Partial<RoutingOutcome> = {}): RoutingOutcome {
  return { ...emptyRoutingOutcome(), ...overrides }
}

function makeRule(overrides: Partial<RoutingRule> = {}): RoutingRule {
  return {
    id: 'rrl_test',
    name: 'Test rule',
    enabled: true,
    order: 1,
    match: {
      endpoints: [],
      requestedModels: [],
      apiKeyIds: [],
      stream: 'any',
      minEstimatedPromptTokens: '',
      maxEstimatedPromptTokens: '',
    },
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

describe('shouldPreserveAuthorization', () => {
  it('preserves only when the selected routing outcome says passthrough and preserve', () => {
    expect(shouldPreserveAuthorization(outcome({ authMode: 'passthrough', preserveAuthorization: true }))).toBe(true)
    expect(shouldPreserveAuthorization(outcome({ authMode: 'passthrough', preserveAuthorization: false }))).toBe(false)
    expect(shouldPreserveAuthorization(outcome({ authMode: 'require_key', preserveAuthorization: true }))).toBe(false)
  })
})

describe('resolveProxyRouting ordering', () => {
  it('lets a require_key rule ordered above a passthrough rule win when its key matches', () => {
    const rewriteRule = makeRule({
      id: 'rrl_local',
      order: 1,
      authMode: 'require_key',
      action: { type: 'rewrite_model', model: 'qwen3.6-35b' },
      match: { ...makeRule().match, requestedModels: ['claude-haiku-4-5-20251001'], apiKeyIds: ['key_opencode'] },
    })
    const passthroughRule = makeRule({
      id: 'rrl_anthropic',
      order: 2,
      authMode: 'passthrough',
      preserveAuthorization: true,
      target: { type: 'direct', baseUrl: 'https://api.anthropic.com/v1' },
      match: { ...makeRule().match, endpoints: ['/v1/messages'] },
    })
    routingRulesMock.listRoutingRules.mockReturnValue([rewriteRule, passthroughRule])

    const decision = resolveProxyRouting(
      '/v1/messages',
      { model: 'claude-haiku-4-5-20251001' },
      'key_opencode',
      new Headers(),
    )

    expect(decision.matchedRule?.id).toBe('rrl_local')
    expect(decision.action).toEqual({ type: 'rewrite_model', model: 'qwen3.6-35b' })
    expect(decision.authMode).toBe('require_key')
  })

  it('falls through to the passthrough rule when the require_key rule key does not match', () => {
    const rewriteRule = makeRule({
      id: 'rrl_local',
      order: 1,
      authMode: 'require_key',
      action: { type: 'rewrite_model', model: 'qwen3.6-35b' },
      match: { ...makeRule().match, requestedModels: ['claude-haiku-4-5-20251001'], apiKeyIds: ['key_opencode'] },
    })
    const passthroughRule = makeRule({
      id: 'rrl_anthropic',
      order: 2,
      authMode: 'passthrough',
      preserveAuthorization: true,
      target: { type: 'direct', baseUrl: 'https://api.anthropic.com/v1' },
      match: { ...makeRule().match, endpoints: ['/v1/messages'] },
    })
    routingRulesMock.listRoutingRules.mockReturnValue([rewriteRule, passthroughRule])

    // No resolved llama-dash key (e.g. Claude Code OAuth token): the key-scoped
    // rule cannot match, so passthrough to Anthropic wins.
    const decision = resolveProxyRouting('/v1/messages', { model: 'claude-haiku-4-5-20251001' }, null, new Headers())

    expect(decision.matchedRule?.id).toBe('rrl_anthropic')
    expect(decision.authMode).toBe('passthrough')
  })
})

describe('proxyRoutingNeedsBody', () => {
  it('never reads the body for GET/HEAD', () => {
    routingRulesMock.listRoutingRules.mockReturnValue([
      makeRule({ authMode: 'passthrough', match: { ...makeRule().match, requestedModels: ['x'] } }),
    ])
    expect(proxyRoutingNeedsBody('GET', '/v1/models', null)).toBe(false)
  })

  it('reads the body for a passthrough rule with body matchers even without a key', () => {
    routingRulesMock.listRoutingRules.mockReturnValue([
      makeRule({ authMode: 'passthrough', match: { ...makeRule().match, requestedModels: ['claude-opus-4-6'] } }),
    ])
    expect(proxyRoutingNeedsBody('POST', '/v1/messages', null)).toBe(true)
  })

  it('does not read the body for a require_key body-scoped rule when the caller is unauthenticated', () => {
    apiKeysMock.hasAnyUserKeys.mockReturnValue(true)
    routingRulesMock.listRoutingRules.mockReturnValue([
      makeRule({ authMode: 'require_key', match: { ...makeRule().match, requestedModels: ['claude-opus-4-6'] } }),
    ])
    expect(proxyRoutingNeedsBody('POST', '/v1/messages', null)).toBe(false)
  })

  it('reads the body for a require_key body-scoped rule once the caller is authenticated', () => {
    routingRulesMock.listRoutingRules.mockReturnValue([
      makeRule({ authMode: 'require_key', match: { ...makeRule().match, requestedModels: ['claude-opus-4-6'] } }),
    ])
    expect(proxyRoutingNeedsBody('POST', '/v1/messages', 'key_test')).toBe(true)
  })
})
