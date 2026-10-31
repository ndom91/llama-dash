import { describe, expect, it } from 'vitest'
import { buildDirectUpstream } from './upstream'
import { PROVIDER_ENDPOINTS } from '../../lib/providers'
import { DirectTargetSchema } from '../../lib/schemas/routing-rule'
import * as v from 'valibot'

describe('buildDirectUpstream', () => {
  it('keeps the /v1 prefix for Anthropic mount points', () => {
    expect(buildDirectUpstream('https://api.minimax.io/anthropic', '/v1/messages', '')).toBe(
      'https://api.minimax.io/anthropic/v1/messages',
    )
  })

  it('drops the /v1 prefix for versioned bases', () => {
    expect(buildDirectUpstream('https://api.minimax.io/v1', '/v1/chat/completions', '')).toBe(
      'https://api.minimax.io/v1/chat/completions',
    )
  })

  it('joins a v4 base correctly', () => {
    expect(buildDirectUpstream('https://api.z.ai/api/paas/v4', '/v1/chat/completions', '')).toBe(
      'https://api.z.ai/api/paas/v4/chat/completions',
    )
  })

  it('preserves the query string', () => {
    expect(buildDirectUpstream('https://api.minimax.io/anthropic', '/v1/messages', 'beta=true')).toBe(
      'https://api.minimax.io/anthropic/v1/messages?beta=true',
    )
  })

  it('honours an explicit pathJoin override', () => {
    expect(buildDirectUpstream('https://api.z.ai/api/anthropic', '/v1/messages', '', 'keep-v1')).toBe(
      'https://api.z.ai/api/anthropic/v1/messages',
    )
  })

  it('rejects hosts that are not on the allowlist', () => {
    expect(() => buildDirectUpstream('https://evil.example.com/v1', '/v1/messages', '')).toThrow()
  })
})

describe('DirectTargetSchema', () => {
  it('accepts every catalog provider base URL', () => {
    for (const endpoint of PROVIDER_ENDPOINTS) {
      const result = v.safeParse(DirectTargetSchema, {
        type: 'direct',
        baseUrl: endpoint.baseUrl,
        pathJoin: endpoint.pathJoin,
      })
      expect(result.success, `${endpoint.id} should be allowed`).toBe(true)
    }
  })

  it('still accepts the legacy public API bases', () => {
    expect(v.safeParse(DirectTargetSchema, { type: 'direct', baseUrl: 'https://api.openai.com/v1' }).success).toBe(true)
    expect(v.safeParse(DirectTargetSchema, { type: 'direct', baseUrl: 'https://api.anthropic.com/v1' }).success).toBe(
      true,
    )
  })

  it('rejects non-HTTPS and unknown hosts', () => {
    expect(v.safeParse(DirectTargetSchema, { type: 'direct', baseUrl: 'http://api.minimax.io/v1' }).success).toBe(false)
    expect(v.safeParse(DirectTargetSchema, { type: 'direct', baseUrl: 'https://evil.example.com/v1' }).success).toBe(
      false,
    )
  })
})
