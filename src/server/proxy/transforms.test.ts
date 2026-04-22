import { describe, expect, it, vi } from 'vitest'

vi.mock('../admin/model-aliases.ts', () => ({
  resolveAlias: (model: string) => model,
}))

vi.mock('../admin/settings.ts', () => ({
  getRequestLimits: () => ({ maxMessages: null, maxEstimatedTokens: null }),
}))

vi.mock('../admin/routing-rules.ts', () => ({
  listRoutingRules: () => [],
  evaluateRoutingRules: vi.fn(() => ({ matchedRule: null, action: null })),
}))

import { evaluateRoutingRules } from '../admin/routing-rules.ts'
import { applyTransforms } from './transforms.ts'

describe('applyTransforms', () => {
  it('skips routing evaluation when skipRouting is true', () => {
    const body = { model: 'gpt-4', stream: true }
    applyTransforms(body, { keyRow: null, endpoint: '/v1/messages', method: 'POST', skipRouting: true })
    expect(evaluateRoutingRules).not.toHaveBeenCalled()
  })

  it('applies rewrite_model actions to the parsed body', () => {
    vi.mocked(evaluateRoutingRules).mockReturnValueOnce({
      matchedRule: {
        id: 'rrl_rewrite',
        name: 'Rewrite rule',
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
        action: { type: 'rewrite_model', model: 'qwen2.5-32b-instruct' },
        createdAt: new Date(0).toISOString(),
        updatedAt: new Date(0).toISOString(),
      },
      action: { type: 'rewrite_model', model: 'qwen2.5-32b-instruct' },
    })

    const result = applyTransforms(
      { model: 'gpt-4', stream: true },
      { keyRow: null, endpoint: '/v1/chat/completions', method: 'POST', skipRouting: false },
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

  it('preserves routing metadata on routing reject', () => {
    vi.mocked(evaluateRoutingRules).mockReturnValueOnce({
      matchedRule: {
        id: 'rrl_reject',
        name: 'Reject rule',
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
        action: { type: 'reject', reason: 'Blocked by policy' },
        createdAt: new Date(0).toISOString(),
        updatedAt: new Date(0).toISOString(),
      },
      action: { type: 'reject', reason: 'Blocked by policy' },
    })

    const result = applyTransforms(
      { model: 'gpt-4', stream: true },
      { keyRow: null, endpoint: '/v1/chat/completions', method: 'POST', skipRouting: false },
    )

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.body.error.type).toBe('routing_rule_rejected')
      expect(result.routing.ruleName).toBe('Reject rule')
      expect(result.routing.rejectReason).toBe('Blocked by policy')
    }
  })
})
