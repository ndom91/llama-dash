import { config } from '../config.ts'
import { authenticateRequest } from './auth.ts'
import { writeRequestLog } from './log.ts'
import { recordTokenUsage } from './rate-limiter.ts'
import { applyTransforms } from './transforms.ts'
import { SseUsageScanner, type Usage, usageFromJsonBody } from './usage.ts'

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
    if (!HOP_BY_HOP.has(key.toLowerCase())) out.set(key, value)
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

export async function handleProxyRequest(request: Request): Promise<Response> {
  const startedAt = Date.now()
  const method = request.method.toUpperCase()
  const url = new URL(request.url)
  const endpoint = url.pathname
  const upstream = `${config.llamaSwapUrl}${url.pathname}${url.search}`

  const reqHeaders = filterRequestHeaders(request.headers)
  const hasBody = method !== 'GET' && method !== 'HEAD'

  let reqBodyText: string | null = null
  if (hasBody) {
    reqBodyText = await request.text()
  }

  const authResult = authenticateRequest(request)
  if (!authResult.ok) {
    const headers = new Headers({ 'content-type': 'application/json' })
    if (authResult.retryAfterMs) {
      headers.set('retry-after', String(Math.ceil(authResult.retryAfterMs / 1000)))
    }
    return new Response(JSON.stringify(authResult.body), { status: authResult.status, headers })
  }

  const keyId = authResult.keyId
  const keyRow = authResult.keyRow

  let parsedBody: Record<string, unknown> | null = null
  if (hasBody && reqBodyText) {
    try {
      parsedBody = JSON.parse(reqBodyText)
    } catch {
      // non-JSON body — skip transforms
    }
  }

  if (parsedBody) {
    const transformResult = applyTransforms(parsedBody, { keyRow, endpoint, method })
    if (!transformResult.ok) {
      return Response.json(transformResult.body, { status: transformResult.status })
    }
    if (transformResult.mutated) {
      reqBodyText = JSON.stringify(transformResult.body)
    }
  }

  const fetchBody = reqBodyText
    ? new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(reqBodyText!))
          controller.close()
        },
      })
    : undefined

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
      usage: { model: null, promptTokens: null, completionTokens: null, totalTokens: null },
      streamed: false,
      error: message,
      reqHeaders: JSON.stringify(reqHeaders),
      reqBody: reqBodyText,
      resHeaders: null,
      resBody: null,
      keyId,
    })
    return Response.json({ error: { message: `Upstream unreachable: ${message}` } }, { status: 502 })
  }

  const resHeadersObj = filterResponseHeaders(upstreamResponse.headers)
  const resHeadersJson = JSON.stringify(headersToRecord(upstreamResponse.headers))
  const contentType = upstreamResponse.headers.get('content-type') ?? ''
  const isSse = contentType.includes('text/event-stream')
  const isJson = contentType.includes('application/json')

  if (!upstreamResponse.body) {
    writeLog({
      startedAt,
      status: upstreamResponse.status,
      method,
      endpoint,
      usage: { model: null, promptTokens: null, completionTokens: null, totalTokens: null },
      streamed: false,
      error: null,
      reqHeaders: JSON.stringify(reqHeaders),
      reqBody: reqBodyText,
      resHeaders: resHeadersJson,
      resBody: null,
      keyId,
    })
    return new Response(null, { status: upstreamResponse.status, headers: resHeadersObj })
  }

  const reader = upstreamResponse.body.getReader()
  const decoder = new TextDecoder()
  const sseScanner = isSse ? new SseUsageScanner() : null
  const responseChunks: Array<string> = []

  const body = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { value, done } = await reader.read()
        if (done) {
          controller.close()
          const tail = decoder.decode()
          if (tail) {
            responseChunks.push(tail)
            if (sseScanner) sseScanner.feed(tail)
          }
          const resBody = responseChunks.join('')
          const usage: Usage = sseScanner
            ? sseScanner.done()
            : isJson
              ? usageFromJsonBody(resBody)
              : { model: null, promptTokens: null, completionTokens: null, totalTokens: null }

          writeLog({
            startedAt,
            status: upstreamResponse.status,
            method,
            endpoint,
            usage,
            streamed: isSse,
            error: null,
            reqHeaders: JSON.stringify(reqHeaders),
            reqBody: reqBodyText,
            resHeaders: resHeadersJson,
            resBody: resBody || null,
            keyId,
          })

          if (keyRow?.rateLimitTpm != null && usage.totalTokens != null) {
            recordTokenUsage(keyRow.id, keyRow.rateLimitTpm, usage.totalTokens)
          }
          return
        }
        controller.enqueue(value)
        const text = decoder.decode(value, { stream: true })
        responseChunks.push(text)
        if (sseScanner) sseScanner.feed(text)
      } catch (err) {
        controller.error(err)
        const message = err instanceof Error ? err.message : String(err)
        writeLog({
          startedAt,
          status: upstreamResponse.status,
          method,
          endpoint,
          usage: sseScanner
            ? sseScanner.done()
            : { model: null, promptTokens: null, completionTokens: null, totalTokens: null },
          streamed: isSse,
          error: message,
          reqHeaders: JSON.stringify(reqHeaders),
          reqBody: reqBodyText,
          resHeaders: resHeadersJson,
          resBody: responseChunks.join('') || null,
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
        usage: sseScanner
          ? sseScanner.done()
          : { model: null, promptTokens: null, completionTokens: null, totalTokens: null },
        streamed: isSse,
        error: 'Client disconnected',
        reqHeaders: JSON.stringify(reqHeaders),
        reqBody: reqBodyText,
        resHeaders: resHeadersJson,
        resBody: responseChunks.join('') || null,
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
  usage: Usage
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
    streamed: input.streamed,
    error: input.error,
    requestHeaders: input.reqHeaders,
    requestBody: input.reqBody,
    responseHeaders: input.resHeaders,
    responseBody: input.resBody,
    keyId: input.keyId,
  })
}
