import { createHash } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { RoutingRule } from '../../lib/schemas/routing-rule'
import type { ApiKey } from '../db/schema'
import { handleProxyRequest } from './handler'

vi.mock('../config.ts', () => ({
  config: {
    inferenceBackend: 'llama-swap',
    inferenceBaseUrl: 'http://llama-swap.test',
    inferenceInsecure: false,
    inferenceConfigFile: '',
    databasePath: ':memory:',
    credentialEncryptionKey: 'x'.repeat(32),
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

vi.mock('../admin/upstream-credentials.ts', () => ({
  getCredentialAuthorizationHeader: () => null,
  getCredentialInjectionSecret: () => null,
  markCredentialUsed: vi.fn(),
}))

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

// The real forward uses undici's `fetch`, which cannot be replaced via
// vi.stubGlobal('fetch'). Mock the forward layer so routing/rewrite decisions
// are asserted from the arguments the handler passes downstream.
const forwardMock = vi.hoisted(() => ({
  forwardUpstreamAndLog: vi.fn(async () => Response.json({ ok: true })),
}))

vi.mock('./forward.ts', async () => {
  const actual = await vi.importActual<typeof import('./forward.ts')>('./forward.ts')
  return {
    ...actual,
    forwardUpstreamAndLog: forwardMock.forwardUpstreamAndLog,
    writeProxyLog: vi.fn(),
  }
})

import { forwardUpstreamAndLog } from './forward.ts'

type ForwardInput = { upstream: string; headers: Record<string, string>; body: unknown }

function lastForward(): ForwardInput {
  const calls = vi.mocked(forwardUpstreamAndLog).mock.calls
  return calls[calls.length - 1][0] as unknown as ForwardInput
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
    target: { type: 'direct', baseUrl: 'https://api.openai.com/v1' },
    authMode: 'passthrough',
    preserveAuthorization: true,
    credentialBindings: [],
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
    expiresAt: null,
    allowedModels: '[]',
    allowedMcpRelays: '[]',
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
    forwardMock.forwardUpstreamAndLog.mockClear()
    forwardMock.forwardUpstreamAndLog.mockResolvedValue(Response.json({ ok: true }))
  })

  it('does not read the request body before rejecting invalid key-auth requests', async () => {
    const request = new Request('http://dash.test/v1/chat/completions', {
      method: 'POST',
      headers: { authorization: 'Bearer invalid' },
      body: JSON.stringify({ model: 'llama3' }),
    })

    const response = await handleProxyRequest(request)

    expect(response.status).toBe(401)
    expect(forwardUpstreamAndLog).not.toHaveBeenCalled()
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
    const forwarded = lastForward()
    expect(forwarded.upstream).toBe('https://api.openai.com/v1/messages')
    expect(forwarded.headers.authorization).toBe('Bearer upstream-token')
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
    expect(lastForward().upstream).toBe('https://api.openai.com/v1/messages')
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
    expect(lastForward().upstream).toBe('http://llama-swap.test/v1/chat/completions')
  })

  it('honors rule order: a require_key rule above a passthrough rule wins when its key matches', async () => {
    const rawKey = 'sk-opencode'
    apiKeysMock.findKeyByHash.mockReturnValue(makeKey(rawKey))
    routingRulesMock.listRoutingRules.mockReturnValue([
      makeRule({
        id: 'rrl_local',
        order: 1,
        authMode: 'require_key',
        preserveAuthorization: false,
        action: { type: 'rewrite_model', model: 'qwen3.6-35b' },
        target: { type: 'llama_swap' },
        match: {
          ...makeRule().match,
          requestedModels: ['claude-haiku-4-5-20251001'],
          apiKeyIds: ['key_test'],
        },
      }),
      makeRule({
        id: 'rrl_anthropic',
        order: 2,
        authMode: 'passthrough',
        preserveAuthorization: true,
        action: { type: 'continue' },
        target: { type: 'direct', baseUrl: 'https://api.anthropic.com/v1' },
        match: { ...makeRule().match, endpoints: ['/v1/messages'] },
      }),
    ])
    const request = new Request('http://dash.test/v1/messages', {
      method: 'POST',
      headers: { authorization: `Bearer ${rawKey}` },
      body: JSON.stringify({ model: 'claude-haiku-4-5-20251001' }),
    })

    const response = await handleProxyRequest(request)

    expect(response.status).toBe(200)
    const forwarded = lastForward()
    expect(forwarded.upstream).toBe('http://llama-swap.test/v1/messages')
    expect(JSON.parse(forwarded.body as string).model).toBe('qwen3.6-35b')
    // require_key routing strips the client Authorization before forwarding.
    expect(forwarded.headers.authorization).toBeUndefined()
  })

  it('routes an OAuth passthrough request to Anthropic when no llama-dash key matches the earlier rule', async () => {
    // Same rule set as above, but the caller presents a non-llama-dash bearer
    // (Claude Code OAuth). The key-scoped rewrite rule cannot match, so the
    // request passes through to Anthropic with the client token preserved.
    apiKeysMock.findKeyByHash.mockReturnValue(undefined)
    routingRulesMock.listRoutingRules.mockReturnValue([
      makeRule({
        id: 'rrl_local',
        order: 1,
        authMode: 'require_key',
        action: { type: 'rewrite_model', model: 'qwen3.6-35b' },
        target: { type: 'llama_swap' },
        match: {
          ...makeRule().match,
          requestedModels: ['claude-haiku-4-5-20251001'],
          apiKeyIds: ['key_test'],
        },
      }),
      makeRule({
        id: 'rrl_anthropic',
        order: 2,
        authMode: 'passthrough',
        preserveAuthorization: true,
        action: { type: 'continue' },
        target: { type: 'direct', baseUrl: 'https://api.anthropic.com/v1' },
        match: { ...makeRule().match, endpoints: ['/v1/messages'] },
      }),
    ])
    const request = new Request('http://dash.test/v1/messages', {
      method: 'POST',
      headers: { authorization: 'Bearer oauth-token' },
      body: JSON.stringify({ model: 'claude-haiku-4-5-20251001' }),
    })

    const response = await handleProxyRequest(request)

    expect(response.status).toBe(200)
    const forwarded = lastForward()
    expect(forwarded.upstream).toBe('https://api.anthropic.com/v1/messages')
    expect(forwarded.headers.authorization).toBe('Bearer oauth-token')
  })

  it('requires key auth before injecting stored credentials for passthrough rules', async () => {
    apiKeysMock.hasAnyUserKeys.mockReturnValue(false)
    routingRulesMock.listRoutingRules.mockReturnValue([
      makeRule({
        match: { ...makeRule().match, endpoints: ['/v1/messages'] },
        target: { type: 'direct', baseUrl: 'https://api.anthropic.com/v1', credentialId: 'ucr_anthropic' },
      }),
    ])
    const request = new Request('http://dash.test/v1/messages', {
      method: 'POST',
      body: JSON.stringify({ model: 'claude-opus-4-6' }),
    })

    const response = await handleProxyRequest(request)

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({
      type: 'error',
      error: {
        message: 'Stored credential routing requires a llama-dash API key',
        type: 'credential_key_required',
      },
    })
    expect(forwardUpstreamAndLog).not.toHaveBeenCalled()
  })
})
