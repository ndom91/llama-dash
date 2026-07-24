import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RoutingRule } from '../../lib/schemas/routing-rule'
import type { ApiKey } from '../db/schema'
import { handleProxyRequest } from './handler'
import { setModelScheduler } from './model-scheduler.ts'
import { ModelScheduler } from './model-scheduler.ts'

vi.mock('../config.ts', () => ({
  config: {
    inferenceBackend: 'llama-swap',
    inferenceBaseUrl: 'http://llama-swap.test',
    inferenceInsecure: false,
    inferenceConfigFile: '',
    databasePath: ':memory:',
    credentialEncryptionKey: 'x'.repeat(32),
    localBackendMaxConcurrent: 2,
    localBackendMaxQueue: 3,
    localBackendQueueTimeoutMs: 5000,
    localBackendModelGrouping: true,
    modelQueueBatchWindowMs: 100,
    modelQueueFairnessTimeoutMs: 30000,
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
  hasAnyUserKeys: vi.fn(() => false),
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

describe('handleProxyRequest queue behavior', () => {
  let scheduler: ModelScheduler

  beforeEach(() => {
    routingRulesMock.listRoutingRules.mockReturnValue([])
    apiKeysMock.hasAnyUserKeys.mockReturnValue(false)
    apiKeysMock.findKeyByHash.mockReturnValue(undefined)
    logsMock.writeRequestLog.mockReset()
    forwardMock.forwardUpstreamAndLog.mockClear()
    forwardMock.forwardUpstreamAndLog.mockImplementation(async () => Response.json({ ok: true }))

    scheduler = new ModelScheduler({
      maxConcurrency: 2,
      maxQueueSize: 3,
      queueTimeoutMs: 5000,
      batchWindowMs: 50,
      fairnessTimeoutMs: 30000,
      modelGrouping: true,
    })
    setModelScheduler(scheduler)
  })

  afterEach(() => {
    scheduler.reset()
  })

  it('queues a second local model while the first stream body is still open', async () => {
    vi.useFakeTimers()
    scheduler = new ModelScheduler({
      maxConcurrency: 1,
      maxQueueSize: 10,
      queueTimeoutMs: 60_000,
      batchWindowMs: 0,
      fairnessTimeoutMs: 30_000,
      modelGrouping: true,
    })
    setModelScheduler(scheduler)

    let streamController!: ReadableStreamDefaultController<Uint8Array>
    let forwardCalls = 0
    forwardMock.forwardUpstreamAndLog.mockImplementation(async () => {
      forwardCalls++
      if (forwardCalls === 1) {
        return new Response(
          new ReadableStream<Uint8Array>({
            start(controller) {
              streamController = controller
              controller.enqueue(new TextEncoder().encode('data: {"thinking":true}\n\n'))
            },
          }),
          { status: 200, headers: { 'content-type': 'text/event-stream' } },
        )
      }
      return Response.json({ id: 'qwen-27b-done' })
    })

    const firstResp = await handleProxyRequest(
      new Request('http://dash.test/v1/chat/completions', {
        method: 'POST',
        body: JSON.stringify({ model: 'qwen-35b', stream: true }),
      }),
    )
    expect(firstResp.status).toBe(200)
    expect(forwardUpstreamAndLog).toHaveBeenCalledTimes(1)
    expect(scheduler.getActiveSlots()).toBe(1)

    const secondPromise = handleProxyRequest(
      new Request('http://dash.test/v1/chat/completions', {
        method: 'POST',
        body: JSON.stringify({ model: 'qwen-27b' }),
      }),
    )

    await vi.waitFor(() => {
      expect(scheduler.getQueueDepth()).toBe(1)
    })

    // Concurrency=1: second must wait — not preempt the in-flight 35b stream
    expect(forwardUpstreamAndLog).toHaveBeenCalledTimes(1)
    expect(scheduler.getActiveSlots()).toBe(1)
    expect(scheduler.getCurrentModel()).toBe('qwen-35b')

    const reader = firstResp.body!.getReader()
    await reader.read()
    streamController.close()
    await reader.read()

    await vi.advanceTimersByTimeAsync(0)
    const secondResp = await secondPromise
    expect(forwardUpstreamAndLog).toHaveBeenCalledTimes(2)
    expect(secondResp.status).toBe(200)
    await secondResp.arrayBuffer()
    await vi.waitFor(() => {
      expect(scheduler.getActiveSlots()).toBe(0)
    })

    vi.useRealTimers()
  })

  it('routes local backend requests through the scheduler', async () => {
    forwardMock.forwardUpstreamAndLog.mockImplementation(async () => Response.json({ ok: true }))

    const request = new Request('http://dash.test/v1/chat/completions', {
      method: 'POST',
      body: JSON.stringify({ model: 'llama3' }),
    })
    const resp = await handleProxyRequest(request)

    expect(resp.status).toBe(200)
    expect(forwardUpstreamAndLog).toHaveBeenCalledTimes(1)
    await resp.arrayBuffer()
  })

  it('bypasses scheduler for direct upstream requests', async () => {
    routingRulesMock.listRoutingRules.mockReturnValue([
      makeRule({
        match: { ...makeRule().match, endpoints: ['/v1/chat/completions'] },
      }),
    ])

    const request = new Request('http://dash.test/v1/chat/completions', {
      method: 'POST',
      body: JSON.stringify({ model: 'gpt-4' }),
    })

    const response = await handleProxyRequest(request)

    expect(response.status).toBe(200)
    expect(forwardUpstreamAndLog).toHaveBeenCalledTimes(1)
    const lastCall = vi.mocked(forwardUpstreamAndLog).mock.calls[0][0] as { upstream: string }
    expect(lastCall.upstream).toContain('api.openai.com')
    expect(scheduler.getActiveSlots()).toBe(0)
  })

  it('returns 503 when queue is full', async () => {
    scheduler = new ModelScheduler({
      maxConcurrency: 1,
      maxQueueSize: 1,
      queueTimeoutMs: 5000,
      batchWindowMs: 50,
      fairnessTimeoutMs: 30000,
      modelGrouping: true,
    })
    setModelScheduler(scheduler)

    forwardMock.forwardUpstreamAndLog.mockImplementation(() => new Promise<Response>(() => {}))

    const r1 = new Request('http://dash.test/v1/chat/completions', {
      method: 'POST',
      body: JSON.stringify({ model: 'llama3' }),
    })
    handleProxyRequest(r1)

    const r2 = new Request('http://dash.test/v1/chat/completions', {
      method: 'POST',
      body: JSON.stringify({ model: 'llama3' }),
    })
    handleProxyRequest(r2)

    const r3 = new Request('http://dash.test/v1/chat/completions', {
      method: 'POST',
      body: JSON.stringify({ model: 'llama3' }),
    })
    const response = await handleProxyRequest(r3)

    expect(response.status).toBe(503)
    const body = await response.json()
    expect((body as any).error?.type).toBe('queue_overflow')
    expect(response.headers.get('retry-after')).toBe('30')
  })

  it('returns 408 when queue timeout is exceeded', async () => {
    vi.useFakeTimers()
    scheduler = new ModelScheduler({
      maxConcurrency: 1,
      maxQueueSize: 10,
      queueTimeoutMs: 1000,
      batchWindowMs: 50,
      fairnessTimeoutMs: 30000,
      modelGrouping: true,
    })
    setModelScheduler(scheduler)

    forwardMock.forwardUpstreamAndLog.mockImplementation(() => new Promise<Response>(() => {}))

    const r1 = new Request('http://dash.test/v1/chat/completions', {
      method: 'POST',
      body: JSON.stringify({ model: 'llama3' }),
    })
    handleProxyRequest(r1)

    const r2Promise = handleProxyRequest(
      new Request('http://dash.test/v1/chat/completions', {
        method: 'POST',
        body: JSON.stringify({ model: 'llama3' }),
      }),
    )

    await vi.advanceTimersByTimeAsync(1100)

    const response = await r2Promise
    expect(response.status).toBe(408)
    const body = await response.json()
    expect((body as any).error?.type).toBe('queue_timeout')
    vi.useRealTimers()
  })

  it('returns 503 with correct queue depth info', async () => {
    scheduler = new ModelScheduler({
      maxConcurrency: 1,
      maxQueueSize: 2,
      queueTimeoutMs: 5000,
      batchWindowMs: 50,
      fairnessTimeoutMs: 30000,
      modelGrouping: true,
    })
    setModelScheduler(scheduler)

    forwardMock.forwardUpstreamAndLog.mockImplementation(() => new Promise<Response>(() => {}))

    handleProxyRequest(
      new Request('http://dash.test/v1/chat/completions', {
        method: 'POST',
        body: JSON.stringify({ model: 'llama3' }),
      }),
    )

    handleProxyRequest(
      new Request('http://dash.test/v1/chat/completions', {
        method: 'POST',
        body: JSON.stringify({ model: 'llama3' }),
      }),
    )

    handleProxyRequest(
      new Request('http://dash.test/v1/chat/completions', {
        method: 'POST',
        body: JSON.stringify({ model: 'llama3' }),
      }),
    )

    const response = await handleProxyRequest(
      new Request('http://dash.test/v1/chat/completions', {
        method: 'POST',
        body: JSON.stringify({ model: 'llama3' }),
      }),
    )

    expect(response.status).toBe(503)
    const body = await response.json()
    expect((body as any).error?.queue_depth).toBe(2)
    expect((body as any).error?.max_queue).toBe(2)
  })

  it('returns 503 for SSE requests when queue is full', async () => {
    scheduler = new ModelScheduler({
      maxConcurrency: 1,
      maxQueueSize: 1,
      queueTimeoutMs: 5000,
      batchWindowMs: 50,
      fairnessTimeoutMs: 30000,
      modelGrouping: true,
    })
    setModelScheduler(scheduler)

    forwardMock.forwardUpstreamAndLog.mockImplementation(() => new Promise<Response>(() => {}))

    handleProxyRequest(
      new Request('http://dash.test/v1/chat/completions', {
        method: 'POST',
        body: JSON.stringify({ model: 'llama3', stream: true }),
      }),
    )

    handleProxyRequest(
      new Request('http://dash.test/v1/chat/completions', {
        method: 'POST',
        body: JSON.stringify({ model: 'llama3', stream: true }),
      }),
    )

    const response = await handleProxyRequest(
      new Request('http://dash.test/v1/chat/completions', {
        method: 'POST',
        body: JSON.stringify({ model: 'llama3', stream: true }),
      }),
    )

    expect(response.status).toBe(503)
    const body = await response.json()
    expect((body as any).error?.type).toBe('queue_overflow')
  })

  it('routes Anthropic endpoint through scheduler', async () => {
    forwardMock.forwardUpstreamAndLog.mockResolvedValue(Response.json({ type: 'message', id: 'msg_123' }))

    const request = new Request('http://dash.test/v1/messages', {
      method: 'POST',
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 100,
        system: 'Be helpful',
        messages: [{ role: 'user', content: 'Hi' }],
      }),
    })
    const resp = await handleProxyRequest(request)

    expect(resp.status).toBe(200)
    expect(forwardUpstreamAndLog).toHaveBeenCalledTimes(1)
  })

  it('routes Anthropic SSE through scheduler', async () => {
    forwardMock.forwardUpstreamAndLog.mockResolvedValue(Response.json({ type: 'message_start' }))

    const request = new Request('http://dash.test/v1/messages', {
      method: 'POST',
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 100,
        stream: true,
        messages: [{ role: 'user', content: 'Hi' }],
      }),
    })
    const resp = await handleProxyRequest(request)

    expect(resp.status).toBe(200)
    expect(forwardUpstreamAndLog).toHaveBeenCalledTimes(1)
  })

  it('handles count_tokens endpoint through scheduler', async () => {
    forwardMock.forwardUpstreamAndLog.mockResolvedValue(
      Response.json({ usage: { input_tokens: 10, total_tokens: 10 } }),
    )

    const request = new Request('http://dash.test/v1/messages/count_tokens', {
      method: 'POST',
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        system: 'Be helpful',
        messages: [{ role: 'user', content: 'Hi' }],
      }),
    })
    const resp = await handleProxyRequest(request)

    expect(resp.status).toBe(200)
    expect(forwardUpstreamAndLog).toHaveBeenCalledTimes(1)
  })

  it('returns 503 for different models when queue is full', async () => {
    scheduler = new ModelScheduler({
      maxConcurrency: 1,
      maxQueueSize: 1,
      queueTimeoutMs: 5000,
      batchWindowMs: 50,
      fairnessTimeoutMs: 30000,
      modelGrouping: true,
    })
    setModelScheduler(scheduler)

    forwardMock.forwardUpstreamAndLog.mockImplementation(() => new Promise<Response>(() => {}))

    handleProxyRequest(
      new Request('http://dash.test/v1/chat/completions', {
        method: 'POST',
        body: JSON.stringify({ model: 'llama3' }),
      }),
    )

    handleProxyRequest(
      new Request('http://dash.test/v1/chat/completions', {
        method: 'POST',
        body: JSON.stringify({ model: 'mistral' }),
      }),
    )

    const response = await handleProxyRequest(
      new Request('http://dash.test/v1/chat/completions', {
        method: 'POST',
        body: JSON.stringify({ model: 'qwen' }),
      }),
    )

    expect(response.status).toBe(503)
    const body = await response.json()
    expect((body as any).error?.type).toBe('queue_overflow')
  })

  it('handles embeddings endpoint through scheduler', async () => {
    forwardMock.forwardUpstreamAndLog.mockResolvedValue(Response.json({ data: [{ embedding: [0.1, 0.2, 0.3] }] }))

    const request = new Request('http://dash.test/v1/embeddings', {
      method: 'POST',
      body: JSON.stringify({ model: 'snowflake-arctic-embed', input: 'test text' }),
    })
    const resp = await handleProxyRequest(request)

    expect(resp.status).toBe(200)
    expect(forwardUpstreamAndLog).toHaveBeenCalledTimes(1)
  })

  it('returns 408 with correct error format for Anthropic', async () => {
    vi.useFakeTimers()
    scheduler = new ModelScheduler({
      maxConcurrency: 1,
      maxQueueSize: 10,
      queueTimeoutMs: 1000,
      batchWindowMs: 50,
      fairnessTimeoutMs: 30000,
      modelGrouping: true,
    })
    setModelScheduler(scheduler)

    forwardMock.forwardUpstreamAndLog.mockImplementation(() => new Promise<Response>(() => {}))

    handleProxyRequest(
      new Request('http://dash.test/v1/messages', {
        method: 'POST',
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 100,
          messages: [{ role: 'user', content: 'Hi' }],
        }),
      }),
    )

    const r2Promise = handleProxyRequest(
      new Request('http://dash.test/v1/messages', {
        method: 'POST',
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 100,
          messages: [{ role: 'user', content: 'Hi' }],
        }),
      }),
    )

    await vi.advanceTimersByTimeAsync(1100)

    const response = await r2Promise
    expect(response.status).toBe(408)
    const body = await response.json()
    expect((body as any).type).toBe('error')
    expect((body as any).error?.type).toBe('queue_timeout')
    expect((body as any).error?.message).toContain('timed out')
    vi.useRealTimers()
  })

  it('returns 503 with correct error format for Anthropic', async () => {
    scheduler = new ModelScheduler({
      maxConcurrency: 1,
      maxQueueSize: 1,
      queueTimeoutMs: 5000,
      batchWindowMs: 50,
      fairnessTimeoutMs: 30000,
      modelGrouping: true,
    })
    setModelScheduler(scheduler)

    forwardMock.forwardUpstreamAndLog.mockImplementation(() => new Promise<Response>(() => {}))

    handleProxyRequest(
      new Request('http://dash.test/v1/messages', {
        method: 'POST',
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 100,
          messages: [{ role: 'user', content: 'Hi' }],
        }),
      }),
    )

    handleProxyRequest(
      new Request('http://dash.test/v1/messages', {
        method: 'POST',
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 100,
          messages: [{ role: 'user', content: 'Hi' }],
        }),
      }),
    )

    const response = await handleProxyRequest(
      new Request('http://dash.test/v1/messages', {
        method: 'POST',
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 100,
          messages: [{ role: 'user', content: 'Hi' }],
        }),
      }),
    )

    expect(response.status).toBe(503)
    const body = await response.json()
    expect((body as any).type).toBe('error')
    expect((body as any).error?.type).toBe('queue_overflow')
    expect((body as any).error?.message).toContain('capacity')
  })

  it('handles high concurrency with queue overflow', async () => {
    scheduler = new ModelScheduler({
      maxConcurrency: 2,
      maxQueueSize: 3,
      queueTimeoutMs: 5000,
      batchWindowMs: 50,
      fairnessTimeoutMs: 30000,
      modelGrouping: true,
    })
    setModelScheduler(scheduler)

    forwardMock.forwardUpstreamAndLog.mockImplementation(() => new Promise<Response>(() => {}))

    // Fill 2 slots
    handleProxyRequest(
      new Request('http://dash.test/v1/chat/completions', {
        method: 'POST',
        body: JSON.stringify({ model: 'llama3' }),
      }),
    )

    handleProxyRequest(
      new Request('http://dash.test/v1/chat/completions', {
        method: 'POST',
        body: JSON.stringify({ model: 'llama3' }),
      }),
    )

    // Queue 3 requests
    handleProxyRequest(
      new Request('http://dash.test/v1/chat/completions', {
        method: 'POST',
        body: JSON.stringify({ model: 'mistral' }),
      }),
    )

    handleProxyRequest(
      new Request('http://dash.test/v1/chat/completions', {
        method: 'POST',
        body: JSON.stringify({ model: 'qwen' }),
      }),
    )

    handleProxyRequest(
      new Request('http://dash.test/v1/chat/completions', {
        method: 'POST',
        body: JSON.stringify({ model: 'llama3.1' }),
      }),
    )

    // Next should overflow
    const response = await handleProxyRequest(
      new Request('http://dash.test/v1/chat/completions', {
        method: 'POST',
        body: JSON.stringify({ model: 'llama3' }),
      }),
    )

    expect(response.status).toBe(503)
    const body = await response.json()
    expect((body as any).error?.queue_depth).toBe(3)
    expect((body as any).error?.max_queue).toBe(3)
  })

  it('handles audio transcription endpoint through scheduler', async () => {
    forwardMock.forwardUpstreamAndLog.mockResolvedValue(Response.json({ text: 'Hello world' }))

    const request = new Request('http://dash.test/v1/audio/transcriptions', {
      method: 'POST',
      body: JSON.stringify({ model: 'whisper-1', file: 'test.wav' }),
    })
    const resp = await handleProxyRequest(request)

    expect(resp.status).toBe(200)
    expect(forwardUpstreamAndLog).toHaveBeenCalledTimes(1)
  })

  it('handles image generation endpoint through scheduler', async () => {
    forwardMock.forwardUpstreamAndLog.mockResolvedValue(
      Response.json({ data: [{ url: 'https://example.com/img.png' }] }),
    )

    const request = new Request('http://dash.test/v1/images/generations', {
      method: 'POST',
      body: JSON.stringify({ model: 'flux-schnell', prompt: 'A cat', n: 1, size: '1024x1024' }),
    })
    const resp = await handleProxyRequest(request)

    expect(resp.status).toBe(200)
    expect(forwardUpstreamAndLog).toHaveBeenCalledTimes(1)
  })
})
