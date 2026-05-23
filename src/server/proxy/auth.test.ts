import { createHash } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApiKey } from '../db/schema'
import { authenticateGatewayRequest } from './auth'

const apiKeysMock = vi.hoisted(() => ({
  hasAnyUserKeys: vi.fn(() => true),
  findKeyByHash: vi.fn<(hash: string) => ApiKey | undefined>(() => undefined),
}))

vi.mock('../admin/api-keys.ts', () => ({
  hasAnyUserKeys: apiKeysMock.hasAnyUserKeys,
  findKeyByHash: apiKeysMock.findKeyByHash,
}))

vi.mock('./rate-limiter.ts', () => ({
  checkRpm: () => ({ allowed: true }),
  checkTpm: () => ({ allowed: true }),
}))

function makeKey(rawKey: string): ApiKey {
  return {
    id: 'key_test',
    name: 'Test key',
    keyHash: createHash('sha256').update(rawKey).digest('hex'),
    keyPrefix: rawKey.slice(0, 8),
    createdAt: new Date(0),
    disabledAt: null,
    allowedModels: '[]',
    rateLimitRpm: null,
    rateLimitTpm: null,
    monthlyTokenQuota: null,
    defaultModel: null,
    systemPrompt: null,
    system: false,
  }
}

describe('authenticateGatewayRequest', () => {
  beforeEach(() => {
    apiKeysMock.hasAnyUserKeys.mockReturnValue(true)
    apiKeysMock.findKeyByHash.mockReturnValue(undefined)
  })

  it('fails closed when no user API keys exist', () => {
    apiKeysMock.hasAnyUserKeys.mockReturnValue(false)

    const result = authenticateGatewayRequest(new Request('http://dash.test/mcp-relays/example'))

    expect(result.ok).toBe(false)
    expect(!result.ok && result.status).toBe(403)
    expect(!result.ok && result.body.error.type).toBe('gateway_key_required')
  })

  it('accepts x-llama-dash-api-key when user keys exist', () => {
    const rawKey = 'sk-test'
    apiKeysMock.findKeyByHash.mockReturnValue(makeKey(rawKey))

    const result = authenticateGatewayRequest(
      new Request('http://dash.test/mcp-relays/example', { headers: { 'x-llama-dash-api-key': rawKey } }),
    )

    expect(result.ok).toBe(true)
    expect(result.ok && result.keyId).toBe('key_test')
  })
})
