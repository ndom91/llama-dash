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

/**
 * Handle a /v1/* request: forward it to llama-swap, stream the response back
 * to the client, and record a log row when the exchange completes.
 */
export async function handleProxyRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const startedAt = Date.now()
  const method = (req.method ?? 'GET').toUpperCase()
  const endpoint = (req.url ?? '/').split('?')[0]
  const upstream = `${config.llamaSwapUrl}${req.url}`

  const hasBody = method !== 'GET' && method !== 'HEAD'
  const body = hasBody ? (Readable.toWeb(req) as ReadableStream) : undefined

  let upstreamResponse: Response
  try {
    upstreamResponse = await fetch(upstream, {
      method,
      headers: filterHeaders(req.headers),
      body,
      // @ts-expect-error — Node fetch requires this when streaming a request body
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

  const contentType = upstreamResponse.headers.get('content-type') ?? ''
  const isSse = contentType.includes('text/event-stream')
  const isJson = contentType.includes('application/json')

  if (!upstreamResponse.body) {
    res.end()
    writeLog({
      startedAt,
      status: upstreamResponse.status,
      method,
      endpoint,
      usage: { model: null, promptTokens: null, completionTokens: null, totalTokens: null },
      streamed: false,
      error: null,
    })
    return
  }

  const decoder = new TextDecoder()
  const sseScanner = isSse ? new SseUsageScanner() : null
  const jsonChunks: Array<string> = []

  const reader = upstreamResponse.body.getReader()

  try {
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      if (value) {
        res.write(value)
        const text = decoder.decode(value, { stream: true })
        if (sseScanner) sseScanner.feed(text)
        else if (isJson) jsonChunks.push(text)
      }
    }
    const tail = decoder.decode()
    if (tail) {
      if (sseScanner) sseScanner.feed(tail)
      else if (isJson) jsonChunks.push(tail)
    }
    res.end()
    const usage: Usage = sseScanner
      ? sseScanner.done()
      : isJson
        ? usageFromJsonBody(jsonChunks.join(''))
        : { model: null, promptTokens: null, completionTokens: null, totalTokens: null }

    writeLog({
      startedAt,
      status: upstreamResponse.status,
      method,
      endpoint,
      usage,
      streamed: isSse,
      error: null,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (!res.writableEnded) res.end()
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
  })
}
