import { config } from '../config.ts'
import { authenticateRequest } from './auth.ts'
import { writeRequestLog } from './log.ts'
import { recordTokenUsage } from './rate-limiter.ts'
import { applyTransforms, checkModelAllowed } from './transforms.ts'
import { SseUsageScanner, type UsageWithClose, usageFromJsonBody } from './usage.ts'

const HOP_BY_HOP = new Set([
  'host',
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
])

// Node's fetch (undici) transparently decompresses upstream bodies when we read
// response.body as a ReadableStream. Forwarding `content-encoding: gzip|br|…`
// alongside the already-decoded bytes causes clients to double-decode (e.g.
// Claude Code throws `Decompression error: ZlibError`). Strip these from the
// response hop. `content-length` goes with them since the decoded length
// differs from the compressed length the upstream header announced.
const STRIP_RESPONSE_HEADERS = new Set(['content-encoding', 'content-length'])

// Values for these headers are replaced with [redacted] before headers are
// persisted to SQLite. The client-facing response and the upstream request
// still carry the real values — redaction applies only to the logged copy.
const SENSITIVE_HEADERS = new Set(['authorization', 'x-api-key', 'proxy-authorization', 'cookie', 'set-cookie'])

function redactSensitiveHeaders(headers: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(headers)) {
    out[key] = SENSITIVE_HEADERS.has(key.toLowerCase()) ? '[redacted]' : value
  }
  return out
}

// Anthropic's SDKs expect `{type:"error", error:{type,message}}`; the OpenAI
// SDKs expect `{error:{message,type}}`. Reshape llama-dash-originated errors
// (auth, allow-list, transforms, upstream reachability) so the client renders
// them natively instead of showing a generic parse failure.
function isAnthropicEndpoint(endpoint: string): boolean {
  return endpoint === '/v1/messages' || endpoint === '/v1/messages/count_tokens'
}

function toErrorBody(endpoint: string, body: { error: { message: string; type: string } }): unknown {
  if (!isAnthropicEndpoint(endpoint)) return body
  return { type: 'error', error: { type: body.error.type, message: body.error.message } }
}

function filterRequestHeaders(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {}
  headers.forEach((value, key) => {
    if (!HOP_BY_HOP.has(key.toLowerCase())) out[key] = value
  })
  return out
}

function filterResponseHeaders(upstream: Headers): Headers {
  const out = new Headers()
  upstream.forEach((value, key) => {
    const lower = key.toLowerCase()
    if (HOP_BY_HOP.has(lower)) return
    if (STRIP_RESPONSE_HEADERS.has(lower)) return
    out.set(key, value)
  })
  return out
}

function headersToRecord(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {}
  headers.forEach((value, key) => {
    if (!HOP_BY_HOP.has(key.toLowerCase())) out[key] = value
  })
  return out
}

function nullUsage(model?: string | null): UsageWithClose {
  return {
    model: model ?? null,
    promptTokens: null,
    completionTokens: null,
    totalTokens: null,
    cacheCreationTokens: null,
    cacheReadTokens: null,
    streamCloseMs: null,
  }
}

export async function handleProxyRequest(request: Request): Promise<Response> {
  const startedAt = Date.now()
  const method = request.method.toUpperCase()
  const url = new URL(request.url)
  const endpoint = url.pathname
  const upstream = `${config.llamaSwapUrl}${url.pathname}${url.search}`
  const reqHeaders = filterRequestHeaders(request.headers)
  const loggedReqHeaders = JSON.stringify(redactSensitiveHeaders(reqHeaders))
  const hasBody = method !== 'GET' && method !== 'HEAD'
  const reqContentType = request.headers.get('content-type') ?? ''
  const isMultipart = hasBody && reqContentType.includes('multipart/form-data')

  const authResult = authenticateRequest(request, endpoint)
  if (!authResult.ok) {
    const headers = new Headers({ 'content-type': 'application/json' })
    if (authResult.retryAfterMs) {
      headers.set('retry-after', String(Math.ceil(authResult.retryAfterMs / 1000)))
    }
    return new Response(JSON.stringify(toErrorBody(endpoint, authResult.body)), {
      status: authResult.status,
      headers,
    })
  }

  const keyId = authResult.keyId
  const keyRow = authResult.keyRow

  let reqBodyText: string | null = null
  let parsedBody: Record<string, unknown> | null = null
  let fetchBody: ReadableStream<Uint8Array> | BodyInit | undefined

  if (isMultipart) {
    try {
      const clone = request.clone()
      const formData = await clone.formData()
      const modelField = formData.get('model')
      if (typeof modelField === 'string') {
        parsedBody = { model: modelField }
      }
    } catch {
      // Can't parse form data — still forward the request
    }

    if (parsedBody) {
      const allowErr = checkModelAllowed(keyRow, parsedBody)
      if (allowErr) return Response.json(toErrorBody(endpoint, allowErr.body), { status: allowErr.status })
    }

    fetchBody = request.body ?? undefined
  } else if (hasBody) {
    reqBodyText = await request.text()

    try {
      parsedBody = JSON.parse(reqBodyText)
    } catch {
      // non-JSON body — skip transforms
    }

    if (parsedBody) {
      const transformResult = applyTransforms(parsedBody, { keyRow, endpoint, method })
      if (!transformResult.ok) {
        return Response.json(toErrorBody(endpoint, transformResult.body), { status: transformResult.status })
      }
      if (transformResult.mutated) {
        reqBodyText = JSON.stringify(transformResult.body)
      }
    }

    fetchBody = reqBodyText
      ? new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(reqBodyText!))
            controller.close()
          },
        })
      : undefined
  }

  const reqModel = (parsedBody?.model as string) ?? null

  let upstreamResponse: Response
  try {
    upstreamResponse = await fetch(upstream, {
      method,
      headers: reqHeaders,
      body: fetchBody,
      // @ts-expect-error — Node fetch requires duplex for streaming request bodies
      duplex: hasBody ? 'half' : undefined,
      redirect: 'manual',
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    writeLog({
      startedAt,
      status: 502,
      method,
      endpoint,
      usage: nullUsage(reqModel),
      streamed: false,
      error: message,
      reqHeaders: loggedReqHeaders,
      reqBody: isMultipart ? null : reqBodyText,
      resHeaders: null,
      resBody: null,
      keyId,
    })
    return Response.json(
      toErrorBody(endpoint, { error: { message: `Upstream unreachable: ${message}`, type: 'upstream_unreachable' } }),
      { status: 502 },
    )
  }

  const resHeadersObj = filterResponseHeaders(upstreamResponse.headers)
  const resHeadersJson = JSON.stringify(redactSensitiveHeaders(headersToRecord(upstreamResponse.headers)))
  const contentType = upstreamResponse.headers.get('content-type') ?? ''
  const isSse = contentType.includes('text/event-stream')
  const isJson = contentType.includes('application/json')
  const isBinaryResponse = !isSse && !isJson

  if (!upstreamResponse.body) {
    writeLog({
      startedAt,
      status: upstreamResponse.status,
      method,
      endpoint,
      usage: nullUsage(reqModel),
      streamed: false,
      error: null,
      reqHeaders: loggedReqHeaders,
      reqBody: isMultipart ? null : reqBodyText,
      resHeaders: resHeadersJson,
      resBody: null,
      keyId,
    })
    return new Response(null, { status: upstreamResponse.status, headers: resHeadersObj })
  }

  const reader = upstreamResponse.body.getReader()
  const decoder = isBinaryResponse ? null : new TextDecoder()
  const sseScanner = isSse ? new SseUsageScanner() : null
  const responseChunks: Array<string> = []

  const body = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { value, done } = await reader.read()
        if (done) {
          controller.close()
          if (decoder) {
            const tail = decoder.decode()
            if (tail) {
              responseChunks.push(tail)
              if (sseScanner) sseScanner.feed(tail, Date.now())
            }
          }
          const resBody = decoder ? responseChunks.join('') : null
          const usage: UsageWithClose = sseScanner
            ? sseScanner.done(Date.now())
            : isJson && resBody
              ? { ...usageFromJsonBody(resBody), streamCloseMs: null }
              : nullUsage(reqModel)
          // /v1/messages/count_tokens returns { input_tokens: N } and no output
          // side — treat input as the total so the UI shows a number instead of —.
          if (endpoint === '/v1/messages/count_tokens' && usage.totalTokens == null && usage.promptTokens != null) {
            usage.totalTokens = usage.promptTokens
          }

          writeLog({
            startedAt,
            status: upstreamResponse.status,
            method,
            endpoint,
            usage,
            streamed: isSse,
            error: null,
            reqHeaders: loggedReqHeaders,
            reqBody: isMultipart ? null : reqBodyText,
            resHeaders: resHeadersJson,
            resBody,
            keyId,
          })

          if (keyRow?.rateLimitTpm != null && usage.totalTokens != null) {
            recordTokenUsage(keyRow.id, keyRow.rateLimitTpm, usage.totalTokens)
          }
          return
        }
        controller.enqueue(value)
        if (decoder) {
          const text = decoder.decode(value, { stream: true })
          responseChunks.push(text)
          if (sseScanner) sseScanner.feed(text, Date.now())
        }
      } catch (err) {
        controller.error(err)
        const message = err instanceof Error ? err.message : String(err)
        writeLog({
          startedAt,
          status: upstreamResponse.status,
          method,
          endpoint,
          usage: sseScanner ? sseScanner.done(Date.now()) : nullUsage(reqModel),
          streamed: isSse,
          error: message,
          reqHeaders: loggedReqHeaders,
          reqBody: isMultipart ? null : reqBodyText,
          resHeaders: resHeadersJson,
          resBody: decoder ? responseChunks.join('') || null : null,
          keyId,
        })
      }
    },
    cancel() {
      reader.cancel().catch(() => {})
      writeLog({
        startedAt,
        status: upstreamResponse.status,
        method,
        endpoint,
        usage: sseScanner ? sseScanner.done(Date.now()) : nullUsage(reqModel),
        streamed: isSse,
        error: 'Client disconnected',
        reqHeaders: loggedReqHeaders,
        reqBody: isMultipart ? null : reqBodyText,
        resHeaders: resHeadersJson,
        resBody: decoder ? responseChunks.join('') || null : null,
        keyId,
      })
    },
  })

  return new Response(body, {
    status: upstreamResponse.status,
    headers: resHeadersObj,
  })
}

function writeLog(input: {
  startedAt: number
  status: number
  method: string
  endpoint: string
  usage: UsageWithClose
  streamed: boolean
  error: string | null
  reqHeaders: string | null
  reqBody: string | null
  resHeaders: string | null
  resBody: string | null
  keyId: string | null
}) {
  writeRequestLog({
    startedAt: input.startedAt,
    durationMs: Date.now() - input.startedAt,
    method: input.method,
    endpoint: input.endpoint,
    model: input.usage.model,
    statusCode: input.status,
    promptTokens: input.usage.promptTokens,
    completionTokens: input.usage.completionTokens,
    totalTokens: input.usage.totalTokens,
    cacheCreationTokens: input.usage.cacheCreationTokens,
    cacheReadTokens: input.usage.cacheReadTokens,
    streamed: input.streamed,
    error: input.error,
    requestHeaders: input.reqHeaders,
    requestBody: input.reqBody,
    responseHeaders: input.resHeaders,
    responseBody: input.resBody,
    streamCloseMs: input.usage.streamCloseMs,
    keyId: input.keyId,
  })
}
