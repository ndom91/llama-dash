import { afterEach, type vi } from 'vitest'

export type CapturedUpstreamCall = {
  url: string
  method: string
  headers: Record<string, string>
  body: string | null
}

type FakeUpstreamOptions = {
  status?: number
  headers?: Record<string, string>
  json?: unknown
  text?: string
  sse?: string
}

const captured: CapturedUpstreamCall[] = []
let undiciFetchMock: ReturnType<typeof vi.fn> | null = null

function headersToRecord(headers: HeadersInit | undefined): Record<string, string> {
  if (!headers) return {}
  if (headers instanceof Headers) return Object.fromEntries(headers.entries())
  if (Array.isArray(headers)) return Object.fromEntries(headers)
  return Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), String(v)]))
}

async function bodyToString(body: BodyInit | null | undefined): Promise<string | null> {
  if (body == null) return null
  if (typeof body === 'string') return body
  if (body instanceof Uint8Array) return new TextDecoder().decode(body)
  if (body instanceof ArrayBuffer) return new TextDecoder().decode(body)
  if (typeof Blob !== 'undefined' && body instanceof Blob) return body.text()
  // ReadableStream / FormData / URLSearchParams — best-effort via Request
  try {
    return await new Request('http://upstream.test', { method: 'POST', body }).text()
  } catch {
    return null
  }
}

function responseFromOptions(options: FakeUpstreamOptions = {}): Response {
  if (options.sse != null) {
    return new Response(options.sse, {
      status: options.status ?? 200,
      headers: {
        'content-type': 'text/event-stream',
        ...(options.headers ?? {}),
      },
    })
  }
  if (options.text != null) {
    return new Response(options.text, {
      status: options.status ?? 200,
      headers: options.headers,
    })
  }
  return Response.json(options.json ?? { ok: true }, {
    status: options.status ?? 200,
    headers: options.headers,
  })
}

/**
 * Install a undici `fetch` mock used by the proxy forward path.
 * Call from the test file's top-level (with matching vi.mock('undici')) or via
 * installFakeUpstreamUndiciMock() after the module mock is in place.
 */
export function installFakeUpstream(
  handler?: (call: CapturedUpstreamCall) => FakeUpstreamOptions | Response | Promise<FakeUpstreamOptions | Response>,
) {
  captured.length = 0
  if (!undiciFetchMock) {
    throw new Error('installFakeUpstream: call installFakeUpstreamUndiciMock() / vi.mock undici first')
  }
  undiciFetchMock.mockImplementation(async (url: string | URL, init?: RequestInit) => {
    const call: CapturedUpstreamCall = {
      url: String(url),
      method: init?.method ?? 'GET',
      headers: headersToRecord(init?.headers),
      body: await bodyToString(init?.body ?? null),
    }
    captured.push(call)
    const result = await handler?.(call)
    if (result == null) return responseFromOptions({})
    return result instanceof Response ? result : responseFromOptions(result)
  })
}

export function installFakeUpstreamUndiciMock(fetchMock: ReturnType<typeof vi.fn>) {
  undiciFetchMock = fetchMock
}

export function getUpstreamCalls(): CapturedUpstreamCall[] {
  return [...captured]
}

export function lastUpstreamCall(): CapturedUpstreamCall {
  if (captured.length === 0) throw new Error('No upstream calls captured')
  return captured[captured.length - 1]!
}

export function clearUpstreamCalls() {
  captured.length = 0
  undiciFetchMock?.mockClear()
}

export function openaiChatCompletionJson(model = 'llama3') {
  return {
    id: 'chatcmpl_test',
    object: 'chat.completion',
    model,
    choices: [{ index: 0, message: { role: 'assistant', content: 'ok' }, finish_reason: 'stop' }],
    usage: { prompt_tokens: 3, completion_tokens: 1, total_tokens: 4 },
  }
}

export function openaiSseWithUsage(model = 'llama3') {
  return [
    `data: ${JSON.stringify({ id: 'chatcmpl_test', choices: [{ delta: { content: 'ok' } }] })}\n\n`,
    `data: ${JSON.stringify({
      id: 'chatcmpl_test',
      model,
      choices: [{ delta: {}, finish_reason: 'stop' }],
      usage: { prompt_tokens: 3, completion_tokens: 1, total_tokens: 4 },
    })}\n\n`,
    'data: [DONE]\n\n',
  ].join('')
}

export type DelayedChunk = {
  /** Artificial backend wait before this chunk is emitted. */
  delayMs: number
  text: string
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

/** Streaming SSE response with per-chunk artificial latency (dummy backend waits). */
export function delayedSseResponse(chunks: Array<DelayedChunk>, status = 200): Response {
  const encoder = new TextEncoder()
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      for (const chunk of chunks) {
        if (chunk.delayMs > 0) await sleep(chunk.delayMs)
        controller.enqueue(encoder.encode(chunk.text))
      }
      controller.close()
    },
  })
  return new Response(body, {
    status,
    headers: { 'content-type': 'text/event-stream' },
  })
}

/** Non-streaming JSON response that waits before returning headers+body. */
export function delayedJsonResponse(delayMs: number, json: unknown, status = 200): Promise<Response> {
  return sleep(delayMs).then(() => Response.json(json, { status }))
}

/**
 * Build a chat-completions SSE timeline with random-ish artifact waits:
 * prefill → tokens → [DONE] → trailing close padding (empty, just delay before close).
 */
export function buildTimedChatSseChunks(opts: {
  prefillMs: number
  tokenGapMs: number
  tokenCount?: number
  closePaddingMs?: number
  model?: string
  /** Inflated llama.cpp timings that must NOT be used for wall-clock phase sums. */
  misleadingGpuTimings?: { prompt_ms: number; predicted_ms: number }
}): Array<DelayedChunk> {
  const model = opts.model ?? 'llama3'
  const tokenCount = opts.tokenCount ?? 3
  const chunks: Array<DelayedChunk> = [
    {
      delayMs: opts.prefillMs,
      text: `data: ${JSON.stringify({ id: 'c1', choices: [{ delta: { role: 'assistant' } }] })}\n\n`,
    },
  ]
  for (let i = 0; i < tokenCount; i++) {
    chunks.push({
      delayMs: i === 0 ? 0 : opts.tokenGapMs,
      text: `data: ${JSON.stringify({ id: 'c1', choices: [{ delta: { content: `t${i}` } }] })}\n\n`,
    })
  }
  const usageEvent: Record<string, unknown> = {
    id: 'c1',
    model,
    choices: [{ delta: {}, finish_reason: 'stop' }],
    usage: { prompt_tokens: 4, completion_tokens: tokenCount, total_tokens: 4 + tokenCount },
  }
  if (opts.misleadingGpuTimings) {
    usageEvent.timings = opts.misleadingGpuTimings
  }
  chunks.push({ delayMs: opts.tokenGapMs, text: `data: ${JSON.stringify(usageEvent)}\n\n` })
  chunks.push({ delayMs: 0, text: 'data: [DONE]\n\n' })
  if ((opts.closePaddingMs ?? 0) > 0) {
    // Extra delayed empty comment after [DONE] so streamCloseMs is measurable.
    chunks.push({ delayMs: opts.closePaddingMs!, text: ': close-padding\n\n' })
  }
  return chunks
}

/** Vitest afterEach helper — clears captured calls between tests. */
export function registerFakeUpstreamCleanup() {
  afterEach(() => {
    clearUpstreamCalls()
  })
}
