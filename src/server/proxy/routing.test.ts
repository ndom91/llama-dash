import { describe, expect, it } from 'vitest'
import { emptyRoutingOutcome, type RoutingOutcome } from './transforms'
import { preferPostAuthRouting, shouldPreserveAuthorization } from './routing'

function outcome(overrides: Partial<RoutingOutcome> = {}): RoutingOutcome {
  return { ...emptyRoutingOutcome(), ...overrides }
}

describe('shouldPreserveAuthorization', () => {
  it('preserves only when the selected routing outcome says passthrough and preserve', () => {
    expect(shouldPreserveAuthorization(outcome({ authMode: 'passthrough', preserveAuthorization: true }))).toBe(true)
    expect(shouldPreserveAuthorization(outcome({ authMode: 'passthrough', preserveAuthorization: false }))).toBe(false)
    expect(shouldPreserveAuthorization(outcome({ authMode: 'require_key', preserveAuthorization: true }))).toBe(false)
  })
})

describe('preferPostAuthRouting', () => {
  it('falls back to pre-auth routing when post-auth routing has no match', () => {
    const preAuth = outcome({ ruleId: 'rrl_pre', targetType: 'direct', targetBaseUrl: 'https://api.example.com/v1' })
    expect(preferPostAuthRouting(preAuth, emptyRoutingOutcome())).toBe(preAuth)
  })

  it('uses post-auth routing when it matched a rule', () => {
    const preAuth = outcome({ ruleId: 'rrl_pre', targetType: 'direct', targetBaseUrl: 'https://api.example.com/v1' })
    const postAuth = outcome({ ruleId: 'rrl_post', targetType: 'llama_swap' })
    expect(preferPostAuthRouting(preAuth, postAuth)).toBe(postAuth)
  })
})
