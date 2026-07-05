import { describe, expect, it, vi } from 'vitest'
import type { RoutingDecision } from '../admin/routing-rules.ts'
import type { RoutingRule } from '../../lib/schemas/routing-rule.ts'

vi.mock('../admin/model-aliases.ts', () => ({
  resolveAlias: (model: string) => model,
}))

vi.mock('../admin/settings.ts', () => ({
  getRequestLimits: () => ({ maxMessages: null, maxEstimatedTokens: null }),
}))

import { applyTransforms } from './transforms.ts'

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

const noMatchDecision: RoutingDecision = {
  matchedRule: null,
  action: null,
  target: { type: 'llama_swap' },
  authMode: 'require_key',
  preserveAuthorization: false,
  credentialBindings: [],
}

describe('applyTransforms', () => {
  it('applies the provided routing decision without re-evaluating rules', () => {
    const result = applyTransforms(
      { model: 'gpt-4', stream: true },
      { keyRow: null, endpoint: '/v1/messages', method: 'POST', routingDecision: noMatchDecision },
    )
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.mutated).toBe(false)
      expect(result.body?.model).toBe('gpt-4')
      expect(result.routing.ruleName).toBeNull()
    }
  })

  it('applies rewrite_model actions to the parsed body', () => {
    const rule = makeRule({
      id: 'rrl_rewrite',
      name: 'Rewrite rule',
      action: { type: 'rewrite_model', model: 'qwen2.5-32b-instruct' },
    })
    const decision: RoutingDecision = {
      matchedRule: rule,
      action: { type: 'rewrite_model', model: 'qwen2.5-32b-instruct' },
      target: { type: 'llama_swap' },
      authMode: 'require_key',
      preserveAuthorization: false,
      credentialBindings: [],
    }

    const result = applyTransforms(
      { model: 'gpt-4', stream: true },
      { keyRow: null, endpoint: '/v1/chat/completions', method: 'POST', routingDecision: decision },
    )

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.body?.model).toBe('qwen2.5-32b-instruct')
      expect(result.routing.ruleName).toBe('Rewrite rule')
      expect(result.routing.actionType).toBe('rewrite_model')
      expect(result.routing.requestedModel).toBe('gpt-4')
      expect(result.routing.routedModel).toBe('qwen2.5-32b-instruct')
    }
  })

  it('allows a rewrite whose target model is allow-listed even if the requested model is not', () => {
    const keyRow = {
      id: 'key_opencode',
      allowedModels: JSON.stringify(['qwen3.6-35b']),
      systemPrompt: null,
    } as unknown as Parameters<typeof applyTransforms>[1]['keyRow']
    const rule = makeRule({
      id: 'rrl_rewrite',
      name: 'claude-local',
      action: { type: 'rewrite_model', model: 'qwen3.6-35b' },
    })
    const decision: RoutingDecision = {
      matchedRule: rule,
      action: { type: 'rewrite_model', model: 'qwen3.6-35b' },
      target: { type: 'llama_swap' },
      authMode: 'require_key',
      preserveAuthorization: false,
      credentialBindings: [],
    }

    const result = applyTransforms(
      { model: 'claude-haiku-4-5-20251001' },
      { keyRow, endpoint: '/v1/messages', method: 'POST', routingDecision: decision },
    )

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.body?.model).toBe('qwen3.6-35b')
  })

  it('still rejects when the effective model is not allow-listed', () => {
    const keyRow = {
      id: 'key_opencode',
      allowedModels: JSON.stringify(['qwen3.6-35b']),
      systemPrompt: null,
    } as unknown as Parameters<typeof applyTransforms>[1]['keyRow']

    const result = applyTransforms(
      { model: 'claude-haiku-4-5-20251001' },
      { keyRow, endpoint: '/v1/messages', method: 'POST', routingDecision: noMatchDecision },
    )

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.body.error.type).toBe('model_not_allowed')
  })

  it('preserves routing metadata on routing reject', () => {
    const rule = makeRule({
      id: 'rrl_reject',
      name: 'Reject rule',
      action: { type: 'reject', reason: 'Blocked by policy' },
    })
    const decision: RoutingDecision = {
      matchedRule: rule,
      action: { type: 'reject', reason: 'Blocked by policy' },
      target: { type: 'llama_swap' },
      authMode: 'require_key',
      preserveAuthorization: false,
      credentialBindings: [],
    }

    const result = applyTransforms(
      { model: 'gpt-4', stream: true },
      { keyRow: null, endpoint: '/v1/chat/completions', method: 'POST', routingDecision: decision },
    )

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.body.error.type).toBe('routing_rule_rejected')
      expect(result.routing.ruleName).toBe('Reject rule')
      expect(result.routing.rejectReason).toBe('Blocked by policy')
    }
  })

  it('records continue routing metadata without mutating the body', () => {
    const rule = makeRule({
      id: 'rrl_continue',
      name: 'Continue rule',
      action: { type: 'continue' },
      target: { type: 'direct', baseUrl: 'https://api.openai.com/v1', credentialId: 'ucr_test' },
      authMode: 'passthrough',
      preserveAuthorization: true,
    })
    const decision: RoutingDecision = {
      matchedRule: rule,
      action: { type: 'continue' },
      target: { type: 'direct', baseUrl: 'https://api.openai.com/v1', credentialId: 'ucr_test' },
      authMode: 'passthrough',
      preserveAuthorization: true,
      credentialBindings: [],
    }

    const result = applyTransforms(
      { model: 'gpt-4', stream: true },
      { keyRow: null, endpoint: '/v1/chat/completions', method: 'POST', routingDecision: decision },
    )

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.mutated).toBe(false)
      expect(result.body?.model).toBe('gpt-4')
      expect(result.routing.ruleName).toBe('Continue rule')
      expect(result.routing.actionType).toBe('continue')
      expect(result.routing.authMode).toBe('passthrough')
      expect(result.routing.preserveAuthorization).toBe(true)
      expect(result.routing.targetType).toBe('direct')
      expect(result.routing.targetBaseUrl).toBe('https://api.openai.com/v1')
      expect(result.routing.targetCredentialId).toBe('ucr_test')
    }
  })
})
