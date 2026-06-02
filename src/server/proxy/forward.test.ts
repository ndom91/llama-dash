import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { forwardUpstreamAndLog, writeProxyLog, type ProxyLogInput } from './forward'

const writeRequestLog = vi.hoisted(() => vi.fn())

vi.mock('./log.ts', () => ({ writeRequestLog }))
vi.mock('../admin/settings.ts', () => ({ getPrivacySettings: () => ({ captureResponseBodies: true }) }))
vi.mock('./headers.ts', () => ({
  filterResponseHeaders: (headers: Headers) => headers,
  headersToRecord: () => ({}),
  redactSensitiveHeaders: (headers: Record<string, string>) => headers,
}))
vi.mock('./rate-limiter.ts', () => ({ recordTokenUsage: vi.fn() }))

function input(overrides: Partial<ProxyLogInput> = {}): ProxyLogInput {
  return {
    startedAt: Date.now(),
    status: 200,
    method: 'POST',
    endpoint: '/v1/chat/completions',
    usage: {
      model: 'gemma-4-26B-A4B-it-UD-Q8_K_XL.gguf',
      promptTokens: 10,
      completionTokens: 20,
      totalTokens: 30,
      cacheCreationTokens: null,
      cacheReadTokens: null,
      streamCloseMs: null,
    },
    streamed: true,
    error: null,
    reqHeaders: null,
    reqBody: null,
    resHeaders: null,
    resBody: null,
    keyId: null,
    reqModel: 'gemma-4-26B-A4B-it',
    attribution: { clientName: null, endUserId: null, sessionId: null },
    routing: {
      ruleId: null,
      ruleName: null,
      actionType: null,
      authMode: null,
      preserveAuthorization: false,
      targetType: null,
      targetBaseUrl: null,
      targetCredentialId: null,
      requestedModel: null,
      routedModel: null,
      rejectReason: null,
      credentialBindings: [],
    },
    ...overrides,
  }
}

describe('writeProxyLog', () => {
  beforeEach(() => {
    writeRequestLog.mockClear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('logs the requested model instead of the upstream usage filename', () => {
    writeProxyLog(input())

    expect(writeRequestLog).toHaveBeenCalledWith(expect.objectContaining({ model: 'gemma-4-26B-A4B-it' }))
  })

  it('prefers routed model over requested model', () => {
    writeProxyLog(input({ routing: { ...input().routing, routedModel: 'qwen3.6-coder' } }))

    expect(writeRequestLog).toHaveBeenCalledWith(expect.objectContaining({ model: 'qwen3.6-coder' }))
  })

  it('lets fetch compute content length for forwarded request bodies', async () => {
    const fetchMock = vi.fn(async () => Response.json({ ok: true }))
    vi.stubGlobal('fetch', fetchMock)

    await forwardUpstreamAndLog({
      upstream: 'http://upstream.test/v1/chat/completions',
      method: 'POST',
      headers: { 'content-type': 'application/json', 'content-length': '2' },
      body: '{}',
      hasBody: true,
      startedAt: Date.now(),
      endpoint: '/v1/chat/completions',
      reqModel: null,
      reqHeadersJson: '{}',
      reqBody: null,
      keyId: null,
      keyRow: null,
      attribution: { clientName: null, endUserId: null, sessionId: null },
      routing: input().routing,
    })

    expect(fetchMock).toHaveBeenCalledWith(
      'http://upstream.test/v1/chat/completions',
      expect.objectContaining({
        headers: { 'content-type': 'application/json' },
      }),
    )
  })
})
