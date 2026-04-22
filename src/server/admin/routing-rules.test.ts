import { describe, expect, it } from 'vitest'
import type { RoutingRule } from '../../lib/schemas/routing-rule'
import { evaluateRoutingRules, matchesRoutingRule, type RoutingContext } from './routing-rules'

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
    action: { type: 'rewrite_model', model: 'rewritten-model' },
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
    ...overrides,
  }
}

function makeContext(overrides: Partial<RoutingContext> = {}): RoutingContext {
  return {
    endpoint: '/v1/chat/completions',
    requestedModel: 'gpt-4',
    apiKeyId: 'key_homeassistant',
    stream: true,
    estimatedPromptTokens: 1200,
    ...overrides,
  }
}

describe('matchesRoutingRule', () => {
  it('matches an enabled rule with empty match conditions', () => {
    expect(matchesRoutingRule(makeRule(), makeContext())).toBe(true)
  })

  it('skips disabled rules', () => {
    expect(matchesRoutingRule(makeRule({ enabled: false }), makeContext())).toBe(false)
  })

  it('matches exact endpoint strings', () => {
    const rule = makeRule({ match: { ...makeRule().match, endpoints: ['/v1/messages'] } })
    expect(matchesRoutingRule(rule, makeContext({ endpoint: '/v1/messages' }))).toBe(true)
    expect(matchesRoutingRule(rule, makeContext({ endpoint: '/v1/chat/completions' }))).toBe(false)
  })

  it('matches requested model and key id', () => {
    const baseMatch = makeRule().match
    const rule = makeRule({ match: { ...baseMatch, requestedModels: ['gpt-4'], apiKeyIds: ['key_homeassistant'] } })
    expect(matchesRoutingRule(rule, makeContext())).toBe(true)
    expect(matchesRoutingRule(rule, makeContext({ requestedModel: 'gpt-4o' }))).toBe(false)
    expect(matchesRoutingRule(rule, makeContext({ apiKeyId: 'key_other' }))).toBe(false)
  })

  it('matches stream mode correctly', () => {
    const streamRule = makeRule({ match: { ...makeRule().match, stream: 'stream' } })
    const nonStreamRule = makeRule({ match: { ...makeRule().match, stream: 'non_stream' } })

    expect(matchesRoutingRule(streamRule, makeContext({ stream: true }))).toBe(true)
    expect(matchesRoutingRule(streamRule, makeContext({ stream: false }))).toBe(false)
    expect(matchesRoutingRule(nonStreamRule, makeContext({ stream: false }))).toBe(true)
    expect(matchesRoutingRule(nonStreamRule, makeContext({ stream: true }))).toBe(false)
  })

  it('matches estimated prompt token bounds', () => {
    const rule = makeRule({
      match: {
        ...makeRule().match,
        minEstimatedPromptTokens: '1000',
        maxEstimatedPromptTokens: '2000',
      },
    })

    expect(matchesRoutingRule(rule, makeContext({ estimatedPromptTokens: 1500 }))).toBe(true)
    expect(matchesRoutingRule(rule, makeContext({ estimatedPromptTokens: 999 }))).toBe(false)
    expect(matchesRoutingRule(rule, makeContext({ estimatedPromptTokens: 2001 }))).toBe(false)
    expect(matchesRoutingRule(rule, makeContext({ estimatedPromptTokens: null }))).toBe(false)
  })
})

describe('evaluateRoutingRules', () => {
  it('returns no decision when nothing matches', () => {
    const rule = makeRule({ match: { ...makeRule().match, endpoints: ['/v1/messages'] } })
    expect(evaluateRoutingRules([rule], makeContext()).action).toBeNull()
  })

  it('returns rewrite action for first matching rule', () => {
    const rules = [
      makeRule({ id: 'rrl_first', order: 1, action: { type: 'rewrite_model', model: 'model-a' } }),
      makeRule({ id: 'rrl_second', order: 2, action: { type: 'rewrite_model', model: 'model-b' } }),
    ]

    const decision = evaluateRoutingRules(rules, makeContext())
    expect(decision.matchedRule?.id).toBe('rrl_first')
    expect(decision.action).toEqual({ type: 'rewrite_model', model: 'model-a' })
  })

  it('returns reject action when a reject rule matches', () => {
    const rule = makeRule({
      id: 'rrl_reject',
      action: { type: 'reject', reason: 'Prompt blocked by routing policy' },
    })
    const decision = evaluateRoutingRules([rule], makeContext())
    expect(decision.matchedRule?.id).toBe('rrl_reject')
    expect(decision.action).toEqual({ type: 'reject', reason: 'Prompt blocked by routing policy' })
  })

  it('skips disabled rules and uses the next matching rule', () => {
    const rules = [
      makeRule({ id: 'rrl_disabled', order: 1, enabled: false, action: { type: 'reject', reason: 'disabled' } }),
      makeRule({ id: 'rrl_enabled', order: 2, action: { type: 'rewrite_model', model: 'model-b' } }),
    ]

    const decision = evaluateRoutingRules(rules, makeContext())
    expect(decision.matchedRule?.id).toBe('rrl_enabled')
    expect(decision.action).toEqual({ type: 'rewrite_model', model: 'model-b' })
  })
})
