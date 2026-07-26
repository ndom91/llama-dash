import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { forwardUpstreamAndLog, writeProxyLog, type ProxyLogInput } from './forward'

const writeRequestLog = vi.hoisted(() => vi.fn())
const undiciFetch = vi.hoisted(() => vi.fn())

vi.mock('./log.ts', () => ({ writeRequestLog }))
vi.mock('undici', async (importOriginal) => {
  const actual = await importOriginal<typeof import('undici')>()
  return { ...actual, fetch: undiciFetch }
})
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
      cacheCreationTokens: null,
      cacheReadTokens: null,
      prefillMs: null,
      decodeMs: null,
      streamCloseMs: null,
      modelLoadingMs: null,
      reasoningMs: null,
      responseMs: null,
      gpuPrefillMs: null,
      gpuDecodeMs: null,
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
    undiciFetch.mockClear()
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

  it('logs queueMs when provided', () => {
    writeProxyLog(input({ queueMs: 420 }))

    expect(writeRequestLog).toHaveBeenCalledWith(expect.objectContaining({ queueMs: 420 }))
  })

  it('defaults queueMs to null when omitted', () => {
    writeProxyLog(input())

    expect(writeRequestLog).toHaveBeenCalledWith(expect.objectContaining({ queueMs: null }))
  })

  it('lets fetch compute content length for forwarded request bodies', async () => {
    undiciFetch.mockResolvedValue(Response.json({ ok: true }))

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

    expect(undiciFetch).toHaveBeenCalledWith(
      'http://upstream.test/v1/chat/completions',
      expect.objectContaining({
        headers: { 'content-type': 'application/json' },
      }),
    )
  })

  it('injects : reason / : respond at_ms before first matching SSE token chunks', async () => {
    const encoder = new TextEncoder()
    const upstreamBody = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"reasoning_content":"think"}}]}\n\n'))
        controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"hi"}}]}\n\n'))
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      },
    })
    undiciFetch.mockResolvedValue(
      new Response(upstreamBody, {
        status: 200,
        headers: { 'content-type': 'text/event-stream' },
      }),
    )

    const relayedAtMs = Date.now() - 200
    const response = await forwardUpstreamAndLog({
      upstream: 'http://upstream.test/v1/chat/completions',
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
      hasBody: true,
      startedAt: Date.now() - 500,
      endpoint: '/v1/chat/completions',
      reqModel: 'qwen',
      reqHeadersJson: '{}',
      reqBody: null,
      keyId: null,
      keyRow: null,
      attribution: { clientName: null, endUserId: null, sessionId: null },
      routing: input().routing,
      relayedAtMs,
      queueMs: 0,
    })

    expect(response).toBeInstanceOf(Response)
    if (!(response instanceof Response) || !response.body) throw new Error('expected Response body')

    const text = await new Response(response.body).text()
    const reasonIdx = text.search(/: reason at_ms=\d+/)
    const respondIdx = text.search(/: respond at_ms=\d+/)
    const reasoningDataIdx = text.indexOf('reasoning_content')
    const contentDataIdx = text.indexOf('"content":"hi"')
    expect(reasonIdx).toBeGreaterThanOrEqual(0)
    expect(respondIdx).toBeGreaterThan(reasonIdx)
    expect(reasonIdx).toBeLessThan(reasoningDataIdx)
    expect(respondIdx).toBeLessThan(contentDataIdx)
    // RELAY-relative offsets only — not wall-clock epoch ms.
    const reasonAt = Number(/: reason at_ms=(\d+)/.exec(text)?.[1])
    const respondAt = Number(/: respond at_ms=(\d+)/.exec(text)?.[1])
    expect(reasonAt).toBeLessThan(60_000)
    expect(respondAt).toBeLessThan(60_000)
    expect(respondAt).toBeGreaterThanOrEqual(reasonAt)
    expect(text).not.toMatch(/: reason\n/)
    expect(text).not.toMatch(/: respond\n/)

    await vi.waitFor(() => {
      expect(writeRequestLog).toHaveBeenCalled()
    })
    expect(writeRequestLog).toHaveBeenCalledWith(
      expect.objectContaining({
        queueMs: 0,
        model: 'qwen',
      }),
    )
  })

  it('assembles upstream SSE into chat.completion JSON when assembleNonStream', async () => {
    const encoder = new TextEncoder()
    const upstreamBody = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          encoder.encode(
            'data: {"id":"chatcmpl_x","object":"chat.completion.chunk","model":"llama3","choices":[{"delta":{"role":"assistant","content":"Hi"}}]}\n\n',
          ),
        )
        controller.enqueue(
          encoder.encode(
            'data: {"id":"chatcmpl_x","choices":[{"delta":{},"finish_reason":"stop"}],"usage":{"prompt_tokens":1,"completion_tokens":1},"timings":{"prompt_ms":5,"predicted_ms":8}}\n\n',
          ),
        )
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      },
    })
    undiciFetch.mockResolvedValue(
      new Response(upstreamBody, {
        status: 200,
        headers: { 'content-type': 'text/event-stream' },
      }),
    )

    const response = await forwardUpstreamAndLog({
      upstream: 'http://upstream.test/v1/chat/completions',
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'llama3', stream: true }),
      hasBody: true,
      startedAt: Date.now(),
      endpoint: '/v1/chat/completions',
      reqModel: 'llama3',
      reqHeadersJson: '{}',
      reqBody: '{"model":"llama3","stream":false}',
      keyId: null,
      keyRow: null,
      attribution: { clientName: null, endUserId: null, sessionId: null },
      routing: input().routing,
      queueMs: 0,
      assembleNonStream: true,
    })

    expect(response).toBeInstanceOf(Response)
    if (!(response instanceof Response)) throw new Error('expected Response')
    expect(response.headers.get('content-type')).toContain('application/json')
    const body = await response.json()
    expect(body).toMatchObject({
      object: 'chat.completion',
      choices: [{ message: { role: 'assistant', content: 'Hi' }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 1, completion_tokens: 1 },
    })
    expect(response.headers.get('x-llama-dash-respond-ms')).toBeTruthy()
    await vi.waitFor(() => {
      expect(writeRequestLog).toHaveBeenCalled()
    })
    expect(writeRequestLog).toHaveBeenCalledWith(
      expect.objectContaining({
        streamed: false,
        model: 'llama3',
      }),
    )
  })

  it('sets reason/respond offset headers when assembling a reasoning stream', async () => {
    const encoder = new TextEncoder()
    const upstreamBody = new ReadableStream<Uint8Array>({
      async start(controller) {
        controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"reasoning_content":"t"}}]}\n\n'))
        await new Promise((r) => setTimeout(r, 30))
        controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"a"}}]}\n\n'))
        controller.enqueue(
          encoder.encode(
            'data: {"choices":[{"delta":{},"finish_reason":"stop"}],"usage":{"prompt_tokens":1,"completion_tokens":1},"timings":{"prompt_ms":5,"predicted_ms":40}}\n\n',
          ),
        )
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      },
    })
    undiciFetch.mockResolvedValue(
      new Response(upstreamBody, {
        status: 200,
        headers: { 'content-type': 'text/event-stream' },
      }),
    )

    const response = await forwardUpstreamAndLog({
      upstream: 'http://upstream.test/v1/chat/completions',
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
      hasBody: true,
      startedAt: Date.now(),
      endpoint: '/v1/chat/completions',
      reqModel: 'qwen',
      reqHeadersJson: '{}',
      reqBody: null,
      keyId: null,
      keyRow: null,
      attribution: { clientName: null, endUserId: null, sessionId: null },
      routing: input().routing,
      queueMs: 0,
      assembleNonStream: true,
      relayedAtMs: Date.now(),
    })

    expect(response).toBeInstanceOf(Response)
    if (!(response instanceof Response)) throw new Error('expected Response')
    const reasonMs = Number(response.headers.get('x-llama-dash-reason-ms'))
    const respondMs = Number(response.headers.get('x-llama-dash-respond-ms'))
    expect(reasonMs).toBeGreaterThanOrEqual(0)
    expect(respondMs).toBeGreaterThanOrEqual(reasonMs)
    const body = (await response.json()) as {
      timings_llama_dash?: {
        queue_ms: number
        reason_ms: number | null
        respond_ms: number | null
        prefill_ms: number | null
        response_ms: number | null
      }
      timings?: { prompt_ms: number; predicted_ms: number }
    }
    expect(body.timings?.prompt_ms).toBe(5)
    expect(body.timings_llama_dash).toMatchObject({
      queued: false,
      queue_ms: 0,
      reason_ms: reasonMs,
      respond_ms: respondMs,
      prefill_ms: 5,
    })
    expect(body.timings_llama_dash?.response_ms).toEqual(expect.any(Number))
    await vi.waitFor(() => expect(writeRequestLog).toHaveBeenCalled())
    expect(writeRequestLog).toHaveBeenCalledWith(
      expect.objectContaining({
        streamed: false,
        reasoningMs: expect.any(Number),
      }),
    )
  })
})
