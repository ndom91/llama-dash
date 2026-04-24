import { config } from '../config.ts'
import { evaluateRoutingRules, listRoutingRules } from '../admin/routing-rules.ts'
import { getAttributionSettings } from '../admin/settings.ts'
import { extractAttribution } from './attribution.ts'
import { authenticateRequest } from './auth.ts'
import { writeRequestLog } from './log.ts'
import { recordTokenUsage } from './rate-limiter.ts'
import type { RoutingOutcome } from './transforms.ts'
import { applyTransforms } from './transforms.ts'
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
const PRE_AUTH_PREFIX_BYTES = 16 * 1024

const EMPTY_ROUTING_OUTCOME: RoutingOutcome = {
  ruleId: null,
  ruleName: null,
  actionType: null,
  authMode: null,
  preserveAuthorization: false,
  targetType: null,
  targetBaseUrl: null,
  requestedModel: null,
  routedModel: null,
  rejectReason: null,
}

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
    const lower = key.toLowerCase()
    if (HOP_BY_HOP.has(lower)) return
    if (lower === 'content-length') return
    out[key] = value
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

function buildDirectUpstream(baseUrl: string, endpoint: string, search: string): string {
  const base = new URL(baseUrl)
  const suffix = endpoint === '/v1' ? '' : endpoint.slice('/v1'.length)
  base.pathname = `${base.pathname.replace(/\/$/, '')}${suffix}`
  base.search = search
  return base.toString()
}

function evaluateBodylessRouting(endpoint: string, headers: Headers): RoutingOutcome {
  const decision = evaluateRoutingRules(listRoutingRules(), {
    endpoint,
    requestedModel: null,
    apiKeyId: null,
    stream: false,
    estimatedPromptTokens: null,
    headers,
  })
  return routingOutcomeFromDecision(decision, null)
}

function evaluateParsedRouting(
  endpoint: string,
  parsedBody: Record<string, unknown>,
  headers: Headers,
): RoutingOutcome {
  const decision = evaluateRoutingRules(listRoutingRules(), {
    endpoint,
    requestedModel: typeof parsedBody.model === 'string' ? parsedBody.model : null,
    apiKeyId: null,
    stream: parsedBody.stream === true,
    estimatedPromptTokens: null,
    headers,
  })
  return routingOutcomeFromDecision(decision, typeof parsedBody.model === 'string' ? parsedBody.model : null)
}

function routingOutcomeFromDecision(
  decision: ReturnType<typeof evaluateRoutingRules>,
  requestedModel: string | null,
): RoutingOutcome {
  if (!decision.matchedRule) return { ...EMPTY_ROUTING_OUTCOME }
  return {
    ruleId: decision.matchedRule.id,
    ruleName: decision.matchedRule.name,
    actionType: decision.action?.type ?? null,
    authMode: decision.authMode,
    preserveAuthorization: decision.authMode === 'passthrough' && decision.preserveAuthorization,
    targetType: decision.target.type,
    targetBaseUrl: decision.target.type === 'direct' ? decision.target.baseUrl : null,
    requestedModel,
    routedModel: decision.action?.type === 'rewrite_model' ? decision.action.model : null,
    rejectReason: decision.action?.type === 'reject' ? decision.action.reason : null,
  }
}

async function readBody(request: Request): Promise<{ text: string; prefix: string }> {
  const reader = request.body?.getReader()
  if (!reader) return { text: '', prefix: '' }

  const chunks: Uint8Array[] = []
  let total = 0
  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    total += value.byteLength
    chunks.push(value)
  }

  const combined = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    combined.set(chunk, offset)
    offset += chunk.byteLength
  }
  const text = new TextDecoder().decode(combined)
  return { text, prefix: new TextDecoder().decode(combined.slice(0, PRE_AUTH_PREFIX_BYTES)) }
}

function parseRoutingPrefix(prefix: string): Record<string, unknown> | null {
  const model = prefix.match(/"model"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/)
  const stream = prefix.match(/"stream"\s*:\s*(true|false)/)
  if (!model && !stream) return null
  return {
    ...(model ? { model: JSON.parse(`"${model[1]}"`) } : {}),
    ...(stream ? { stream: stream[1] === 'true' } : {}),
  }
}

function formatError(err: unknown): string {
  if (!(err instanceof Error)) return String(err)
  const cause = err.cause instanceof Error ? `: ${err.cause.message}` : err.cause ? `: ${String(err.cause)}` : ''
  return `${err.message}${cause}`
}

function debugDirectProxy(message: string, fields: Record<string, unknown> = {}) {
  console.log('[proxy:direct]', message, fields)
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
  let upstream = `${config.llamaSwapUrl}${url.pathname}${url.search}`
  const reqHeaders = filterRequestHeaders(request.headers)
  const loggedReqHeaders = () => JSON.stringify(redactSensitiveHeaders(reqHeaders))
  const attribution = extractAttribution(request.headers, getAttributionSettings())
  const hasBody = method !== 'GET' && method !== 'HEAD'
  const reqContentType = request.headers.get('content-type') ?? ''
  const isMultipart = hasBody && reqContentType.includes('multipart/form-data')
  const contentLength = request.headers.get('content-length')

  if (endpoint.startsWith('/v1/')) {
    debugDirectProxy('request received', {
      method,
      endpoint,
      hasBody,
      contentLength,
      contentType: reqContentType,
      incomingAuthorization: request.headers.has('authorization'),
    })
  }

  let reqBodyText: string | null = null
  let preAuthBodyText: string | null = null
  let parsedBody: Record<string, unknown> | null = null
  let fetchBody: ReadableStream<Uint8Array> | BodyInit | undefined
  let reqModel: string | null = null
  let multipartFormData: FormData | null = null
  let routingOutcome: RoutingOutcome = { ...EMPTY_ROUTING_OUTCOME }

  if (isMultipart) {
    try {
      const clone = request.clone()
      multipartFormData = await clone.formData()
      const modelField = multipartFormData.get('model')
      const streamField = multipartFormData.get('stream')
      parsedBody = {
        ...(typeof modelField === 'string' ? { model: modelField } : {}),
        ...(typeof streamField === 'string' ? { stream: streamField === 'true' } : {}),
      }
    } catch {
      // Can't parse form data — still forward the request
    }
  } else if (hasBody) {
    debugDirectProxy('body read start', { endpoint, contentLength })
    const body = await readBody(request)
    reqBodyText = body.text
    preAuthBodyText = body.text
    debugDirectProxy('body read complete', {
      endpoint,
      bytes: Buffer.byteLength(reqBodyText, 'utf8'),
      prefixBytes: Buffer.byteLength(body.prefix, 'utf8'),
    })
    try {
      parsedBody = JSON.parse(reqBodyText)
    } catch {
      parsedBody = parseRoutingPrefix(body.prefix)
    }
  }

  const authResult = authenticateRequest(request, endpoint, parsedBody)
  if (!authResult.ok) {
    const headers = new Headers({ 'content-type': 'application/json' })
    if (authResult.retryAfterMs) {
      headers.set('retry-after', String(Math.ceil(authResult.retryAfterMs / 1000)))
    }
    writeLog({
      startedAt,
      status: authResult.status,
      method,
      endpoint,
      usage: nullUsage(reqModel),
      streamed: false,
      error: authResult.body.error.message,
      reqHeaders: loggedReqHeaders(),
      reqBody: null,
      resHeaders: null,
      resBody: JSON.stringify(toErrorBody(endpoint, authResult.body)),
      keyId: null,
      attribution,
      routing: routingOutcome,
    })
    return new Response(JSON.stringify(toErrorBody(endpoint, authResult.body)), {
      status: authResult.status,
      headers,
    })
  }

  const keyId = authResult.keyId
  const keyRow = authResult.keyRow

  if (!hasBody) {
    routingOutcome = evaluateBodylessRouting(endpoint, request.headers)
  }

  if (!hasBody && routingOutcome.targetType === 'direct' && routingOutcome.targetBaseUrl) {
    upstream = buildDirectUpstream(routingOutcome.targetBaseUrl, endpoint, url.search)
    debugDirectProxy('bodyless target selected', {
      endpoint,
      upstream,
      ruleId: routingOutcome.ruleId,
      authMode: routingOutcome.authMode,
      preserveAuthorization: routingOutcome.preserveAuthorization,
    })
  }

  if (isMultipart) {
    if (parsedBody && Object.keys(parsedBody).length > 0) {
      reqModel = (parsedBody.model as string) ?? null
      const transformResult = applyTransforms(parsedBody, {
        keyRow,
        endpoint,
        method,
        skipRouting: false,
        headers: request.headers,
      })
      routingOutcome = transformResult.routing
      if (!transformResult.ok) {
        writeLog({
          startedAt,
          status: transformResult.status,
          method,
          endpoint,
          usage: nullUsage(reqModel),
          streamed: false,
          error: transformResult.body.error.message,
          reqHeaders: loggedReqHeaders(),
          reqBody: null,
          resHeaders: null,
          resBody: JSON.stringify(transformResult.body),
          keyId,
          attribution,
          routing: routingOutcome,
        })
        return Response.json(toErrorBody(endpoint, transformResult.body), { status: transformResult.status })
      }
      reqModel = (transformResult.body?.model as string) ?? reqModel
      if (multipartFormData && typeof transformResult.body?.model === 'string') {
        multipartFormData.set('model', transformResult.body.model)
      }
    }

    if (routingOutcome.targetType === 'direct' && routingOutcome.targetBaseUrl) {
      upstream = buildDirectUpstream(routingOutcome.targetBaseUrl, endpoint, url.search)
      debugDirectProxy('multipart target selected', {
        endpoint,
        upstream,
        ruleId: routingOutcome.ruleId,
        authMode: routingOutcome.authMode,
        preserveAuthorization: routingOutcome.preserveAuthorization,
      })
    }

    fetchBody = multipartFormData ?? request.body ?? undefined
  } else if (hasBody) {
    if (authResult.passthrough && parsedBody) {
      routingOutcome = evaluateParsedRouting(endpoint, parsedBody, request.headers)
      if (routingOutcome.targetType === 'direct') {
        debugDirectProxy('pre-auth parsed target selected', {
          endpoint,
          ruleId: routingOutcome.ruleId,
          requestedModel: routingOutcome.requestedModel,
          bodyMode: 'buffered',
          authMode: routingOutcome.authMode,
          preserveAuthorization: routingOutcome.preserveAuthorization,
        })
      }
    }

    if (
      authResult.passthrough &&
      routingOutcome.actionType === 'noop' &&
      routingOutcome.targetType === 'direct' &&
      routingOutcome.targetBaseUrl &&
      preAuthBodyText != null
    ) {
      upstream = buildDirectUpstream(routingOutcome.targetBaseUrl, endpoint, url.search)
      debugDirectProxy('forwarding buffered direct noop body', {
        endpoint,
        upstream,
        ruleId: routingOutcome.ruleId,
        bytes: Buffer.byteLength(preAuthBodyText, 'utf8'),
      })
      reqBodyText = preAuthBodyText
      reqHeaders['content-length'] = String(Buffer.byteLength(reqBodyText, 'utf8'))
      fetchBody = reqBodyText || undefined
    } else {
      reqBodyText = preAuthBodyText ?? (await request.text())
      if (!parsedBody) {
        try {
          parsedBody = JSON.parse(reqBodyText)
        } catch {
          // non-JSON body — skip transforms
        }
      }

      if (parsedBody) {
        reqModel = (parsedBody.model as string) ?? null
        const transformResult = applyTransforms(parsedBody, {
          keyRow,
          endpoint,
          method,
          skipRouting: false,
          headers: request.headers,
        })
        routingOutcome = transformResult.routing
        if (!transformResult.ok) {
          writeLog({
            startedAt,
            status: transformResult.status,
            method,
            endpoint,
            usage: nullUsage(reqModel),
            streamed: false,
            error: transformResult.body.error.message,
            reqHeaders: loggedReqHeaders(),
            reqBody: isMultipart ? null : reqBodyText,
            resHeaders: null,
            resBody: JSON.stringify(transformResult.body),
            keyId,
            attribution,
            routing: routingOutcome,
          })
          return Response.json(toErrorBody(endpoint, transformResult.body), { status: transformResult.status })
        }
        if (transformResult.mutated) {
          reqBodyText = JSON.stringify(transformResult.body)
        }
        reqModel = (transformResult.body?.model as string) ?? reqModel
      }

      if (routingOutcome.targetType === 'direct' && routingOutcome.targetBaseUrl) {
        upstream = buildDirectUpstream(routingOutcome.targetBaseUrl, endpoint, url.search)
        debugDirectProxy('json target selected', {
          endpoint,
          upstream,
          ruleId: routingOutcome.ruleId,
          actionType: routingOutcome.actionType,
          authMode: routingOutcome.authMode,
          preserveAuthorization: routingOutcome.preserveAuthorization,
        })
      }

      fetchBody = reqBodyText || undefined
      if (reqBodyText) reqHeaders['content-length'] = String(Buffer.byteLength(reqBodyText, 'utf8'))
    }
  }

  if (authResult.passthrough && parsedBody) {
    routingOutcome = evaluateParsedRouting(endpoint, parsedBody, request.headers)
  }

  const shouldPreserveAuthorization = authResult.passthrough && authResult.preserveAuthorization
  if (routingOutcome.targetType === 'direct') {
    debugDirectProxy('authorization decision', {
      endpoint,
      passthrough: authResult.passthrough,
      preserveAuthorization: authResult.preserveAuthorization,
      shouldPreserveAuthorization,
      incomingAuthorization: request.headers.has('authorization'),
      filteredAuthorization: reqHeaders.authorization ? 'present' : 'absent',
      headerKeys: Object.keys(reqHeaders).sort(),
    })
  }
  if (!shouldPreserveAuthorization) {
    delete reqHeaders.authorization
  }

  let upstreamResponse: Response
  try {
    if (routingOutcome.targetType === 'direct') {
      debugDirectProxy('fetch start', {
        method,
        endpoint,
        upstream,
        hasBody,
        hasFetchBody: fetchBody != null,
        contentType: reqHeaders['content-type'],
        accept: reqHeaders.accept,
        authorization: reqHeaders.authorization ? 'present' : 'absent',
      })
    }
    upstreamResponse = await fetch(upstream, {
      method,
      headers: reqHeaders,
      body: fetchBody,
      // @ts-expect-error — Node fetch requires duplex for streaming request bodies
      duplex: hasBody ? 'half' : undefined,
      redirect: 'manual',
    })
    if (routingOutcome.targetType === 'direct') {
      debugDirectProxy('fetch response', {
        endpoint,
        upstream,
        status: upstreamResponse.status,
        contentType: upstreamResponse.headers.get('content-type'),
      })
    }
  } catch (err) {
    const message = formatError(err)
    if (routingOutcome.targetType === 'direct') {
      debugDirectProxy('fetch error', { endpoint, upstream, error: message })
    }
    writeLog({
      startedAt,
      status: 502,
      method,
      endpoint,
      usage: nullUsage(reqModel),
      streamed: false,
      error: message,
      reqHeaders: loggedReqHeaders(),
      reqBody: isMultipart ? null : reqBodyText,
      resHeaders: null,
      resBody: null,
      keyId,
      attribution,
      routing: routingOutcome,
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
      reqHeaders: loggedReqHeaders(),
      reqBody: isMultipart ? null : reqBodyText,
      resHeaders: resHeadersJson,
      resBody: null,
      keyId,
      attribution,
      routing: routingOutcome,
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
            reqHeaders: loggedReqHeaders(),
            reqBody: isMultipart ? null : reqBodyText,
            resHeaders: resHeadersJson,
            resBody,
            keyId,
            attribution,
            routing: routingOutcome,
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
          reqHeaders: loggedReqHeaders(),
          reqBody: isMultipart ? null : reqBodyText,
          resHeaders: resHeadersJson,
          resBody: decoder ? responseChunks.join('') || null : null,
          keyId,
          attribution,
          routing: routingOutcome,
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
        reqHeaders: loggedReqHeaders(),
        reqBody: isMultipart ? null : reqBodyText,
        resHeaders: resHeadersJson,
        resBody: decoder ? responseChunks.join('') || null : null,
        keyId,
        attribution,
        routing: routingOutcome,
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
  attribution: {
    clientName: string | null
    endUserId: string | null
    sessionId: string | null
  }
  routing: {
    ruleId: string | null
    ruleName: string | null
    actionType: string | null
    authMode: string | null
    preserveAuthorization: boolean
    targetType: string | null
    targetBaseUrl: string | null
    requestedModel: string | null
    routedModel: string | null
    rejectReason: string | null
  }
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
    clientName: input.attribution.clientName,
    endUserId: input.attribution.endUserId,
    sessionId: input.attribution.sessionId,
    routingRuleId: input.routing.ruleId,
    routingRuleName: input.routing.ruleName,
    routingActionType: input.routing.actionType,
    routingAuthMode: input.routing.authMode,
    routingPreserveAuthorization: input.routing.preserveAuthorization,
    routingTargetType: input.routing.targetType,
    routingTargetBaseUrl: input.routing.targetBaseUrl,
    routingRequestedModel: input.routing.requestedModel,
    routingRoutedModel: input.routing.routedModel,
    routingRejectReason: input.routing.rejectReason,
  })
}
