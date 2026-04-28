import type { ApiKey } from '../db/schema.ts'
import { getPrivacySettings } from '../admin/settings.ts'
import { headersToRecord, filterResponseHeaders, redactSensitiveHeaders } from './headers.ts'
import { writeRequestLog } from './log.ts'
import { recordTokenUsage } from './rate-limiter.ts'
import { BoundedTextCapture } from './text-capture.ts'
import type { RoutingOutcome } from './transforms.ts'
import { SseUsageScanner, type UsageWithClose, usageFromJsonBody } from './usage.ts'

type Attribution = {
  clientName: string | null
  endUserId: string | null
  sessionId: string | null
}

export type ProxyLogInput = {
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
  reqModel: string | null
  attribution: Attribution
  routing: RoutingOutcome
}

export function formatUpstreamError(err: unknown): string {
  if (!(err instanceof Error)) return String(err)
  const cause = err.cause instanceof Error ? `: ${err.cause.message}` : err.cause ? `: ${String(err.cause)}` : ''
  return `${err.message}${cause}`
}

export function nullUsage(model?: string | null): UsageWithClose {
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

export function writeProxyLog(input: ProxyLogInput) {
  const loggedModel = input.routing.routedModel ?? input.routing.requestedModel ?? input.reqModel ?? input.usage.model

  writeRequestLog({
    startedAt: input.startedAt,
    durationMs: Date.now() - input.startedAt,
    method: input.method,
    endpoint: input.endpoint,
    model: loggedModel,
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

export async function forwardUpstreamAndLog(input: {
  upstream: string
  method: string
  headers: Record<string, string>
  body: ReadableStream<Uint8Array> | BodyInit | undefined
  hasBody: boolean
  startedAt: number
  endpoint: string
  reqModel: string | null
  reqHeadersJson: string
  reqBody: string | null
  keyId: string | null
  keyRow: ApiKey | null
  attribution: Attribution
  routing: RoutingOutcome
}): Promise<Response | { upstreamError: string }> {
  let upstreamResponse: Response
  try {
    upstreamResponse = await fetch(input.upstream, {
      method: input.method,
      headers: input.headers,
      body: input.body,
      // @ts-expect-error — Node fetch requires duplex for streaming request bodies
      duplex: input.hasBody ? 'half' : undefined,
      redirect: 'manual',
    })
  } catch (err) {
    return { upstreamError: formatUpstreamError(err) }
  }

  const resHeadersObj = filterResponseHeaders(upstreamResponse.headers)
  const resHeadersJson = JSON.stringify(redactSensitiveHeaders(headersToRecord(upstreamResponse.headers)))
  const contentType = upstreamResponse.headers.get('content-type') ?? ''
  const isSse = contentType.includes('text/event-stream')
  const isJson = contentType.includes('application/json')
  const isBinaryResponse = !isSse && !isJson
  const captureResponseBodies = getPrivacySettings().captureResponseBodies

  if (!upstreamResponse.body) {
    writeProxyLog({
      startedAt: input.startedAt,
      status: upstreamResponse.status,
      method: input.method,
      endpoint: input.endpoint,
      usage: nullUsage(input.reqModel),
      streamed: false,
      error: null,
      reqHeaders: input.reqHeadersJson,
      reqBody: input.reqBody,
      resHeaders: resHeadersJson,
      resBody: null,
      keyId: input.keyId,
      reqModel: input.reqModel,
      attribution: input.attribution,
      routing: input.routing,
    })
    return new Response(null, { status: upstreamResponse.status, headers: resHeadersObj })
  }

  const reader = upstreamResponse.body.getReader()
  const decoder = isBinaryResponse ? null : new TextDecoder()
  const sseScanner = isSse ? new SseUsageScanner() : null
  const responseCapture = decoder ? new BoundedTextCapture() : null

  const responseBody = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { value, done } = await reader.read()
        if (done) {
          controller.close()
          if (decoder) {
            const tail = decoder.decode()
            if (tail) {
              responseCapture?.append(tail)
              if (sseScanner) sseScanner.feed(tail, Date.now())
            }
          }
          const resBody = captureResponseBodies ? (responseCapture?.text() ?? null) : null
          const usageBody = responseCapture?.usageText()
          const usage: UsageWithClose = sseScanner
            ? sseScanner.done(Date.now())
            : isJson && usageBody
              ? { ...usageFromJsonBody(usageBody), streamCloseMs: null }
              : nullUsage(input.reqModel)
          if (
            input.endpoint === '/v1/messages/count_tokens' &&
            usage.totalTokens == null &&
            usage.promptTokens != null
          ) {
            usage.totalTokens = usage.promptTokens
          }

          writeProxyLog({
            startedAt: input.startedAt,
            status: upstreamResponse.status,
            method: input.method,
            endpoint: input.endpoint,
            usage,
            streamed: isSse,
            error: null,
            reqHeaders: input.reqHeadersJson,
            reqBody: input.reqBody,
            resHeaders: resHeadersJson,
            resBody,
            keyId: input.keyId,
            reqModel: input.reqModel,
            attribution: input.attribution,
            routing: input.routing,
          })

          if (input.keyRow?.rateLimitTpm != null && usage.totalTokens != null) {
            recordTokenUsage(input.keyRow.id, input.keyRow.rateLimitTpm, usage.totalTokens)
          }
          return
        }
        controller.enqueue(value)
        if (decoder) {
          const text = decoder.decode(value, { stream: true })
          responseCapture?.append(text)
          if (sseScanner) sseScanner.feed(text, Date.now())
        }
      } catch (err) {
        controller.error(err)
        const message = err instanceof Error ? err.message : String(err)
        writeProxyLog({
          startedAt: input.startedAt,
          status: upstreamResponse.status,
          method: input.method,
          endpoint: input.endpoint,
          usage: sseScanner ? sseScanner.done(Date.now()) : nullUsage(input.reqModel),
          streamed: isSse,
          error: message,
          reqHeaders: input.reqHeadersJson,
          reqBody: input.reqBody,
          resHeaders: resHeadersJson,
          resBody: captureResponseBodies ? (responseCapture?.text() ?? null) : null,
          keyId: input.keyId,
          reqModel: input.reqModel,
          attribution: input.attribution,
          routing: input.routing,
        })
      }
    },
    cancel() {
      reader.cancel().catch(() => {})
      writeProxyLog({
        startedAt: input.startedAt,
        status: upstreamResponse.status,
        method: input.method,
        endpoint: input.endpoint,
        usage: sseScanner ? sseScanner.done(Date.now()) : nullUsage(input.reqModel),
        streamed: isSse,
        error: 'Client disconnected',
        reqHeaders: input.reqHeadersJson,
        reqBody: input.reqBody,
        resHeaders: resHeadersJson,
        resBody: captureResponseBodies ? (responseCapture?.text() ?? null) : null,
        keyId: input.keyId,
        reqModel: input.reqModel,
        attribution: input.attribution,
        routing: input.routing,
      })
    },
  })

  return new Response(responseBody, {
    status: upstreamResponse.status,
    headers: resHeadersObj,
  })
}
