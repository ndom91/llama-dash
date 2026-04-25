import { config } from '../config.ts'
import { getAttributionSettings } from '../admin/settings.ts'
import { extractAttribution } from './attribution.ts'
import { authenticateRequest } from './auth.ts'
import { prepareProxyBody } from './body.ts'
import { toErrorBody } from './errors.ts'
import { filterRequestHeaders, filterResponseHeaders, headersToRecord, redactSensitiveHeaders } from './headers.ts'
import { writeRequestLog } from './log.ts'
import { recordTokenUsage } from './rate-limiter.ts'
import { preferPostAuthRouting, shouldPreserveAuthorization } from './routing.ts'
import type { RoutingOutcome } from './transforms.ts'
import { applyTransforms, emptyRoutingOutcome } from './transforms.ts'
import { selectUpstream } from './upstream.ts'
import { SseUsageScanner, type UsageWithClose, usageFromJsonBody } from './usage.ts'

function formatError(err: unknown): string {
  if (!(err instanceof Error)) return String(err)
  const cause = err.cause instanceof Error ? `: ${err.cause.message}` : err.cause ? `: ${String(err.cause)}` : ''
  return `${err.message}${cause}`
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
  const defaultUpstream = `${config.llamaSwapUrl}${url.pathname}${url.search}`
  let upstream = defaultUpstream
  const reqHeaders = filterRequestHeaders(request.headers)
  const loggedReqHeaders = () => JSON.stringify(redactSensitiveHeaders(reqHeaders))
  const attribution = extractAttribution(request.headers, getAttributionSettings())
  const hasBody = method !== 'GET' && method !== 'HEAD'
  let fetchBody: ReadableStream<Uint8Array> | BodyInit | undefined
  let reqModel: string | null = null
  let routingOutcome: RoutingOutcome = emptyRoutingOutcome()
  const preparedBody = await prepareProxyBody(request, method)
  let { parsedBody, bodyText: reqBodyText, multipartFormData } = preparedBody
  const isMultipart = preparedBody.isMultipart

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
  routingOutcome = authResult.preAuthRouting

  if (!hasBody) {
    upstream = selectUpstream(defaultUpstream, routingOutcome, endpoint, url.search)
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

    routingOutcome = preferPostAuthRouting(authResult.preAuthRouting, routingOutcome)
    upstream = selectUpstream(defaultUpstream, routingOutcome, endpoint, url.search)

    fetchBody = multipartFormData ?? request.body ?? undefined
  } else if (hasBody) {
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

    routingOutcome = preferPostAuthRouting(authResult.preAuthRouting, routingOutcome)
    upstream = selectUpstream(defaultUpstream, routingOutcome, endpoint, url.search)

    fetchBody = reqBodyText || undefined
    if (reqBodyText) reqHeaders['content-length'] = String(Buffer.byteLength(reqBodyText, 'utf8'))
  }

  if (!shouldPreserveAuthorization(routingOutcome)) {
    delete reqHeaders.authorization
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
    const message = formatError(err)
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
