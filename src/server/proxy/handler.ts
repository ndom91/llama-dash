import type { IncomingMessage, ServerResponse } from 'node:http'
import { Readable } from 'node:stream'
import { config } from '../config.ts'
import { writeRequestLog } from './log.ts'
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

const filterHeaders = (src: IncomingMessage['headers']): Record<string, string> => {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(src)) {
    if (v == null) continue
    if (HOP_BY_HOP.has(k.toLowerCase())) continue
    out[k] = Array.isArray(v) ? v.join(', ') : v
  }
  return out
}

const copyResponseHeaders = (upstream: Response, res: ServerResponse) => {
  upstream.headers.forEach((value, key) => {
    if (HOP_BY_HOP.has(key.toLowerCase())) return
    res.setHeader(key, value)
  })
}

const headersToRecord = (headers: Headers): Record<string, string> => {
  const out: Record<string, string> = {}
  headers.forEach((value, key) => {
    if (!HOP_BY_HOP.has(key.toLowerCase())) out[key] = value
  })
  return out
}

async function drainStream(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  const chunks: Array<string> = []
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    if (value) chunks.push(decoder.decode(value, { stream: true }))
  }
  const tail = decoder.decode()
  if (tail) chunks.push(tail)
  return chunks.join('')
}

/**
 * Handle a /v1/* request: forward it to llama-swap, stream the response back
 * to the client, and record a log row when the exchange completes.
 */
export async function handleProxyRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const startedAt = Date.now()
  const method = (req.method ?? 'GET').toUpperCase()
  const endpoint = (req.url ?? '/').split('?')[0]
  const upstream = `${config.llamaSwapUrl}${req.url}`

  const reqHeaders = filterHeaders(req.headers)
  const hasBody = method !== 'GET' && method !== 'HEAD'

  let fetchBody: ReadableStream | undefined
  let reqBodyPromise: Promise<string> | undefined
  if (hasBody) {
    const reqStream = Readable.toWeb(req) as ReadableStream<Uint8Array>
    const [forFetch, forLog] = reqStream.tee()
    fetchBody = forFetch
    reqBodyPromise = drainStream(forLog)
  }

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
    const reqBodyText = (await reqBodyPromise) ?? null
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
    })
    if (!res.headersSent) {
      res.statusCode = 502
      res.setHeader('content-type', 'application/json')
    }
    res.end(JSON.stringify({ error: { message: `Upstream unreachable: ${message}` } }))
    return
  }

  res.statusCode = upstreamResponse.status
  copyResponseHeaders(upstreamResponse, res)

  const resHeaders = JSON.stringify(headersToRecord(upstreamResponse.headers))
  const contentType = upstreamResponse.headers.get('content-type') ?? ''
  const isSse = contentType.includes('text/event-stream')
  const isJson = contentType.includes('application/json')

  if (!upstreamResponse.body) {
    res.end()
    const reqBodyText = (await reqBodyPromise) ?? null
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
      resHeaders,
      resBody: null,
    })
    return
  }

  const decoder = new TextDecoder()
  const sseScanner = isSse ? new SseUsageScanner() : null
  const responseChunks: Array<string> = []

  const reader = upstreamResponse.body.getReader()

  try {
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      if (value) {
        res.write(value)
        const text = decoder.decode(value, { stream: true })
        responseChunks.push(text)
        if (sseScanner) sseScanner.feed(text)
      }
    }
    const tail = decoder.decode()
    if (tail) {
      responseChunks.push(tail)
      if (sseScanner) sseScanner.feed(tail)
    }
    res.end()

    const resBody = responseChunks.join('')
    const usage: Usage = sseScanner
      ? sseScanner.done()
      : isJson
        ? usageFromJsonBody(resBody)
        : { model: null, promptTokens: null, completionTokens: null, totalTokens: null }

    const reqBodyText = (await reqBodyPromise) ?? null
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
      resHeaders,
      resBody: resBody || null,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (!res.writableEnded) res.end()
    const reqBodyText = (await reqBodyPromise?.catch(() => null)) ?? null
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
      resHeaders,
      resBody: responseChunks.join('') || null,
    })
  }
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
  })
}
