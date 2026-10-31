import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { forwardUpstreamAndLog, type ProxyLogInput, writeProxyLog } from './forward'

const writeRequestLog = vi.hoisted(() => vi.fn())
const undiciFetch = vi.hoisted(() => vi.fn())
const privacy = vi.hoisted(() => ({ captureResponseBodies: true }))

vi.mock('./log.ts', () => ({ writeRequestLog }))
vi.mock('undici', async (importOriginal) => {
  const actual = await importOriginal<typeof import('undici')>()
  return { ...actual, fetch: undiciFetch }
})
vi.mock('../admin/settings.ts', () => ({ getPrivacySettings: () => privacy }))
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
      targetPathJoin: null,
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
    privacy.captureResponseBodies = true
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

  it('captures a JSON Responses API reply without a content type', async () => {
    const body = JSON.stringify({
      model: 'gpt-5.6-terra',
      output: [{ type: 'message', content: [{ type: 'output_text', text: 'Hello' }] }],
      usage: { input_tokens: 10, output_tokens: 20, total_tokens: 30 },
    })
    undiciFetch.mockResolvedValue(new Response(body, { headers: { 'content-type': '' } }))

    const response = await forwardUpstreamAndLog({
      upstream: 'https://chatgpt.com/backend-api/codex/responses?include=reasoning.encrypted_content',
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{"stream":false}',
      hasBody: true,
      startedAt: Date.now(),
      endpoint: '/v1/responses',
      reqModel: 'gpt-5.6-terra',
      reqHeadersJson: '{}',
      reqBody: null,
      keyId: null,
      keyRow: null,
      attribution: { clientName: 'opencode', endUserId: null, sessionId: null },
      routing: input().routing,
    })

    await (response as Response).text()

    expect(writeRequestLog).toHaveBeenCalledWith(
      expect.objectContaining({
        responseBody: body,
        promptTokens: 10,
        completionTokens: 20,
        totalTokens: 30,
      }),
    )
  })

  it('extracts non-streaming phase timings while forwarding the response unchanged', async () => {
    const body = JSON.stringify({
      usage: { prompt_tokens: 10, completion_tokens: 20 },
      timings: { prompt_ms: 2307.982, predicted_ms: 1847.728 },
    })
    undiciFetch.mockResolvedValue(Response.json(JSON.parse(body)))
    const response = await forwardUpstreamAndLog({
      upstream: 'http://upstream.test/v1/chat/completions',
      method: 'POST',
      headers: {},
      body: '{}',
      hasBody: true,
      startedAt: Date.now(),
      endpoint: '/v1/chat/completions',
      reqModel: 'local',
      reqHeadersJson: '{}',
      reqBody: null,
      keyId: null,
      keyRow: null,
      attribution: { clientName: null, endUserId: null, sessionId: null },
      routing: input().routing,
    })
    expect(await (response as Response).text()).toBe(body)
    expect(writeRequestLog).toHaveBeenCalledWith(
      expect.objectContaining({ streamed: false, prefillMs: 2307.982, decodeMs: 1847.728 }),
    )
  })

  it('extracts final streaming timings beyond the bounded body capture', async () => {
    const stream = `data: ${JSON.stringify({ choices: [{ delta: { content: 'x'.repeat(270_000) } }] })}\n\ndata: ${JSON.stringify({ timings: { prompt_ms: 101.293, predicted_ms: 4780 }, usage: { completion_tokens: 548 } })}\n\ndata: [DONE]\n\n`
    undiciFetch.mockResolvedValue(new Response(stream, { headers: { 'content-type': 'text/event-stream' } }))
    const response = await forwardUpstreamAndLog({
      upstream: 'http://upstream.test/v1/chat/completions',
      method: 'POST',
      headers: {},
      body: '{}',
      hasBody: true,
      startedAt: Date.now(),
      endpoint: '/v1/chat/completions',
      reqModel: 'local',
      reqHeadersJson: '{}',
      reqBody: null,
      keyId: null,
      keyRow: null,
      attribution: { clientName: null, endUserId: null, sessionId: null },
      routing: input().routing,
    })
    expect(await (response as Response).text()).toBe(stream)
    expect(writeRequestLog).toHaveBeenCalledWith(
      expect.objectContaining({
        streamed: true,
        prefillMs: 101.293,
        decodeMs: 4780,
        firstOutputMs: expect.any(Number),
        outputSpanMs: 0,
        responseBody: expect.stringContaining('...[truncated'),
      }),
    )
  })

  it('scans a headerless Codex Responses API stream', async () => {
    const body = [
      'event: response.output_text.delta',
      'data: {"type":"response.output_text.delta","delta":"Hello"}',
      '',
      'event: response.completed',
      'data: {"type":"response.completed","response":{"model":"gpt-5.6-terra","usage":{"input_tokens":10,"output_tokens":20,"total_tokens":30}}}',
      '',
    ].join('\n')
    undiciFetch.mockResolvedValue(new Response(body, { headers: { 'content-type': '' } }))

    const response = await forwardUpstreamAndLog({
      upstream: 'https://chatgpt.com/backend-api/codex/responses',
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{"stream":true}',
      hasBody: true,
      startedAt: Date.now(),
      endpoint: '/v1/responses',
      reqModel: 'gpt-5.6-terra',
      reqHeadersJson: '{}',
      reqBody: null,
      keyId: null,
      keyRow: null,
      attribution: { clientName: 'opencode', endUserId: null, sessionId: null },
      routing: input().routing,
    })

    await (response as Response).text()

    expect(writeRequestLog).toHaveBeenCalledWith(
      expect.objectContaining({
        responseBody: body,
        streamed: true,
        firstOutputMs: expect.any(Number),
        outputSpanMs: 0,
        promptTokens: 10,
        completionTokens: 20,
        totalTokens: 30,
      }),
    )
  })

  it('records observed output timing when response capture is disabled', async () => {
    privacy.captureResponseBodies = false
    const body = `data: ${JSON.stringify({ type: 'response.created', padding: 'x'.repeat(270_000) })}\n\ndata: {"type":"response.output_text.delta","delta":"hello"}\n\ndata: {"type":"response.completed"}\n\n`
    undiciFetch.mockResolvedValue(new Response(body, { headers: { 'content-type': 'text/event-stream' } }))
    const response = await forwardUpstreamAndLog({
      upstream: 'http://upstream.test/v1/responses',
      method: 'POST',
      headers: {},
      body: '{}',
      hasBody: true,
      startedAt: Date.now(),
      endpoint: '/v1/responses',
      reqModel: null,
      reqHeadersJson: '{}',
      reqBody: null,
      keyId: null,
      keyRow: null,
      attribution: { clientName: null, endUserId: null, sessionId: null },
      routing: input().routing,
    })
    expect(await (response as Response).text()).toBe(body)
    expect(writeRequestLog).toHaveBeenCalledWith(
      expect.objectContaining({
        responseBody: null,
        firstOutputMs: expect.any(Number),
        outputSpanMs: 0,
      }),
    )
  })

  describe('a client that hangs up', () => {
    // An upstream SSE stream that sends its events, then stays open until `end()`.
    function heldOpenStream(events: string) {
      let end!: () => void
      const ended = new Promise<void>((resolve) => {
        end = resolve
      })
      const body = new ReadableStream<Uint8Array>({
        async start(controller) {
          controller.enqueue(new TextEncoder().encode(events))
          await ended
          controller.close()
        },
      })
      return { body, end }
    }

    function forwardStream(body: ReadableStream<Uint8Array>) {
      undiciFetch.mockResolvedValue(new Response(body, { headers: { 'content-type': 'text/event-stream' } }))
      return forwardUpstreamAndLog({
        upstream: 'http://llama-swap:8080/v1/chat/completions',
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{"stream":true}',
        hasBody: true,
        startedAt: Date.now(),
        endpoint: '/v1/chat/completions',
        reqModel: 'halogen-qwen3.8-flash-next',
        reqHeadersJson: '{}',
        reqBody: null,
        keyId: null,
        keyRow: null,
        attribution: { clientName: 'relic', endUserId: null, sessionId: null },
        routing: input().routing,
      })
    }

    async function readUntil(response: Response, marker: string | null) {
      const reader = (response.body as ReadableStream<Uint8Array>).getReader()
      const decoder = new TextDecoder()
      let text = ''
      while (marker == null || !text.includes(marker)) {
        const { value, done } = await reader.read()
        if (done) break
        text += decoder.decode(value, { stream: true })
        if (marker == null) break
      }
      await reader.cancel()
      return text
    }

    it('logs a stream it read to [DONE] once, as completed', async () => {
      const upstream = heldOpenStream(
        'data: {"model":"halogen-qwen3.8-flash-next","choices":[{"delta":{"content":"Hi"}}]}\n\ndata: [DONE]\n\n',
      )
      const response = (await forwardStream(upstream.body)) as Response

      await readUntil(response, '[DONE]')
      upstream.end()
      await new Promise((resolve) => setTimeout(resolve, 20))

      expect(writeRequestLog).toHaveBeenCalledTimes(1)
      expect(writeRequestLog).toHaveBeenCalledWith(expect.objectContaining({ error: null, streamed: true }))
    })

    it('logs a stream abandoned before [DONE] once, as a disconnect', async () => {
      const upstream = heldOpenStream('data: {"choices":[{"delta":{"content":"Hi"}}]}\n\n')
      const response = (await forwardStream(upstream.body)) as Response

      await readUntil(response, null)
      upstream.end()
      await new Promise((resolve) => setTimeout(resolve, 20))

      expect(writeRequestLog).toHaveBeenCalledTimes(1)
      expect(writeRequestLog).toHaveBeenCalledWith(expect.objectContaining({ error: 'Client disconnected' }))
    })
  })

  it('does not capture an untyped Responses API reply from another upstream', async () => {
    undiciFetch.mockResolvedValue(new Response(new Uint8Array([0, 255, 1])))

    const response = await forwardUpstreamAndLog({
      upstream: 'https://upstream.test/v1/responses',
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
      hasBody: true,
      startedAt: Date.now(),
      endpoint: '/v1/responses',
      reqModel: 'test-model',
      reqHeadersJson: '{}',
      reqBody: null,
      keyId: null,
      keyRow: null,
      attribution: { clientName: null, endUserId: null, sessionId: null },
      routing: input().routing,
    })

    await (response as Response).arrayBuffer()

    expect(writeRequestLog).toHaveBeenCalledWith(
      expect.objectContaining({ responseBody: null, promptTokens: null, completionTokens: null, totalTokens: null }),
    )
  })
})
