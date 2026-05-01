import { createHash } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { RoutingRule } from '../../lib/schemas/routing-rule'
import type { ApiKey } from '../db/schema'
import { handleProxyRequest } from './handler'

vi.mock('../config.ts', () => ({
  config: {
    llamaSwapUrl: 'http://llama-swap.test',
    llamaSwapInsecure: false,
    llamaSwapConfigFile: '',
    databasePath: ':memory:',
  },
}))

vi.mock('../admin/settings.ts', () => ({
  getAttributionSettings: () => ({ clientHeader: '', endUserHeader: '', sessionHeader: '' }),
  getPrivacySettings: () => ({
    captureRequestBodies: true,
    captureResponseBodies: true,
    maxStoredBodyBytes: 32 * 1024,
  }),
  getRequestLimits: () => ({ maxMessages: null, maxEstimatedTokens: null }),
}))

vi.mock('../admin/model-aliases.ts', () => ({
  resolveAlias: (model: string) => model,
}))

const routingRulesMock = vi.hoisted(() => ({
  listRoutingRules: vi.fn<() => RoutingRule[]>(() => []),
}))

vi.mock('../admin/routing-rules.ts', async () => {
  const actual = await vi.importActual<typeof import('../admin/routing-rules.ts')>('../admin/routing-rules.ts')
  return {
    ...actual,
    listRoutingRules: routingRulesMock.listRoutingRules,
  }
})

const apiKeysMock = vi.hoisted(() => ({
  hasAnyUserKeys: vi.fn(() => true),
  findKeyByHash: vi.fn<(hash: string) => ApiKey | undefined>(() => undefined),
}))

vi.mock('../admin/api-keys.ts', () => ({
  hasAnyUserKeys: apiKeysMock.hasAnyUserKeys,
  findKeyByHash: apiKeysMock.findKeyByHash,
}))

const logsMock = vi.hoisted(() => ({
  writeRequestLog: vi.fn(),
}))

vi.mock('./log.ts', () => ({
  writeRequestLog: logsMock.writeRequestLog,
}))

vi.mock('./rate-limiter.ts', () => ({
  checkRpm: () => ({ allowed: true }),
  checkTpm: () => ({ allowed: true }),
  recordTokenUsage: vi.fn(),
}))

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
    target: { type: 'direct', baseUrl: 'https://api.openai.com/v1' },
    authMode: 'passthrough',
    preserveAuthorization: true,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
    ...overrides,
  }
}

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

describe('handleProxyRequest auth/body ordering', () => {
  beforeEach(() => {
    routingRulesMock.listRoutingRules.mockReturnValue([])
    apiKeysMock.hasAnyUserKeys.mockReturnValue(true)
    apiKeysMock.findKeyByHash.mockReturnValue(undefined)
    logsMock.writeRequestLog.mockReset()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({ id: 'ok', usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } }),
      ),
    )
  })

  it('does not read the request body before rejecting invalid key-auth requests', async () => {
    const request = new Request('http://dash.test/v1/chat/completions', {
      method: 'POST',
      headers: { authorization: 'Bearer invalid' },
      body: JSON.stringify({ model: 'llama3' }),
    })

    const response = await handleProxyRequest(request)

    expect(response.status).toBe(401)
    expect(fetch).not.toHaveBeenCalled()
    await expect(request.text()).resolves.toBe('{"model":"llama3"}')
  })

  it('matches endpoint-only passthrough rules without reading the request body first', async () => {
    routingRulesMock.listRoutingRules.mockReturnValue([
      makeRule({ match: { ...makeRule().match, endpoints: ['/v1/messages'] } }),
    ])
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.enqueue(new TextEncoder().encode('{"model":"claude-opus-4-6"}'))
        controller.close()
      },
    })
    const request = new Request('http://dash.test/v1/messages', {
      method: 'POST',
      headers: { authorization: 'Bearer upstream-token' },
      body,
      ...({ duplex: 'half' } as RequestInit),
    })

    const response = await handleProxyRequest(request)

    expect(response.status).toBe(200)
    expect(fetch).toHaveBeenCalledWith(
      'https://api.openai.com/v1/messages',
      expect.objectContaining({ headers: expect.objectContaining({ authorization: 'Bearer upstream-token' }) }),
    )
  })

  it('reads body before auth when pre-auth passthrough rules need body fields', async () => {
    routingRulesMock.listRoutingRules.mockReturnValue([
      makeRule({ match: { ...makeRule().match, requestedModels: ['claude-opus-4-6'] } }),
    ])
    const request = new Request('http://dash.test/v1/messages', {
      method: 'POST',
      headers: { authorization: 'Bearer upstream-token' },
      body: JSON.stringify({ model: 'claude-opus-4-6' }),
    })

    const response = await handleProxyRequest(request)

    expect(response.status).toBe(200)
    expect(fetch).toHaveBeenCalledWith('https://api.openai.com/v1/messages', expect.any(Object))
  })

  it('reads the body after valid key auth when no pre-auth body fields are needed', async () => {
    const rawKey = 'sk-valid'
    apiKeysMock.findKeyByHash.mockReturnValue(makeKey(rawKey))
    const request = new Request('http://dash.test/v1/chat/completions', {
      method: 'POST',
      headers: { authorization: `Bearer ${rawKey}` },
      body: JSON.stringify({ model: 'llama3' }),
    })

    const response = await handleProxyRequest(request)

    expect(response.status).toBe(200)
    expect(fetch).toHaveBeenCalledWith('http://llama-swap.test/v1/chat/completions', expect.any(Object))
  })
})
