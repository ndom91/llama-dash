import { Agent, type RequestInit as UndiciRequestInit, fetch as undiciFetch } from 'undici'
import { getPrivacySettings } from '../admin/settings.ts'
import { config } from '../config.ts'
import type { ApiKey } from '../db/schema.ts'
import type { ProxyForwardBody } from './body.ts'
import { filterResponseHeaders, headersToRecord, redactSensitiveHeaders } from './headers.ts'
import type { RequestAttribution } from './attribution.ts'
import { type RequestLogInput, writeRequestLog } from './log.ts'
import { recordTokenUsage } from './rate-limiter.ts'
import { BoundedTextCapture } from './text-capture.ts'
import type { RoutingOutcome } from './transforms.ts'
import { SseUsageScanner, type UsageWithClose, usageFromJsonBody } from './usage.ts'
import { errorMessage } from '../error-message.ts'

export type ProxyLogInput = {
  startedAt: number
  status: number
  requestClass?: RequestLogInput['requestClass']
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
  attribution: RequestAttribution
  routing: RoutingOutcome
  credentialInjectionJson?: string | null
}

function formatUpstreamError(err: unknown): string {
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

function isChatGptCodexResponsesUrl(upstream: string): boolean {
  const url = new URL(upstream)
  return url.origin === 'https://chatgpt.com' && url.pathname === '/backend-api/codex/responses'
}

function isStreamingRequest(body: ProxyForwardBody): boolean {
  if (typeof body !== 'string') return false
  try {
    return JSON.parse(body).stream === true
  } catch {
    return false
  }
}

function deriveClientHost(reqHeadersJson: string | null): string | null {
  if (!reqHeadersJson) return null
  try {
    const headers = JSON.parse(reqHeadersJson) as Record<string, string>
    const origin = headers.origin
    if (origin) {
      try {
        return new URL(origin).hostname
      } catch {
        return origin
      }
    }
    const xff = headers['x-forwarded-for']
    if (xff) return xff.split(',')[0].trim() || null
    return null
  } catch {
    return null
  }
}

export function writeProxyLog(input: ProxyLogInput) {
  const loggedModel = input.routing.routedModel ?? input.routing.requestedModel ?? input.reqModel ?? input.usage.model

  writeRequestLog({
    startedAt: input.startedAt,
    durationMs: Date.now() - input.startedAt,
    requestClass: input.requestClass ?? 'inference',
    method: input.method,
    endpoint: input.endpoint,
    model: loggedModel,
    statusCode: input.status,
    promptTokens: input.usage.promptTokens,
    completionTokens: input.usage.completionTokens,
    totalTokens: input.usage.totalTokens,
    cacheCreationTokens: input.usage.cacheCreationTokens,
    cacheReadTokens: input.usage.cacheReadTokens,
    cacheReadTokensIncludedInPrompt: input.usage.cacheReadTokensIncludedInPrompt,
    streamed: input.streamed,
    error: input.error,
    requestHeaders: input.reqHeaders,
    requestBody: input.reqBody,
    responseHeaders: input.resHeaders,
    responseBody: input.resBody,
    streamCloseMs: input.usage.streamCloseMs,
    prefillMs: input.usage.prefillMs ?? null,
    decodeMs: input.usage.decodeMs ?? null,
    firstOutputMs: input.usage.firstOutputMs ?? null,
    outputSpanMs: input.usage.outputSpanMs ?? null,
    keyId: input.keyId,
    clientHost: deriveClientHost(input.reqHeaders),
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
    routingTargetCredentialId: input.routing.targetCredentialId,
    routingRequestedModel: input.routing.requestedModel,
    routingRoutedModel: input.routing.routedModel,
    routingRejectReason: input.routing.rejectReason,
    credentialInjectionJson: input.credentialInjectionJson ?? null,
  })
}

// Dedicated undici dispatcher for the upstream proxy fetch only. Raises the
// default 300s headersTimeout so long non-streaming jobs (image gen, big
// batches) that send no response headers until done don't get killed and
// reported as `upstream_unreachable`. Scoped here so other outbound fetches
// (models.dev pricing, GitHub update check, auth) keep fast-failing defaults.
let proxyDispatcher: Agent | undefined
function getProxyDispatcher(): Agent {
  if (!proxyDispatcher) {
    proxyDispatcher = new Agent({
      headersTimeout: config.upstreamHeadersTimeoutMs,
      bodyTimeout: config.upstreamBodyTimeoutMs,
    })
  }
  return proxyDispatcher
}

function stripContentLength(headers: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() !== 'content-length') out[key] = value
  }
  return out
}

export async function forwardUpstreamAndLog(input: {
  upstream: string
  method: string
  headers: Record<string, string>
  body: ProxyForwardBody
  hasBody: boolean
  startedAt: number
  endpoint: string
  requestClass?: RequestLogInput['requestClass']
  reqModel: string | null
  reqHeadersJson: string
  reqBody: string | null
  keyId: string | null
  keyRow: ApiKey | null
  attribution: RequestAttribution
  routing: RoutingOutcome
  credentialInjectionJson?: string | null
}): Promise<Response | { upstreamError: string }> {
  let upstreamResponse: Awaited<ReturnType<typeof undiciFetch>>
  try {
    const init: UndiciRequestInit = {
      method: input.method,
      headers: stripContentLength(input.headers),
      body: input.body as UndiciRequestInit['body'],
      duplex: input.hasBody ? 'half' : undefined,
      dispatcher: getProxyDispatcher(),
      redirect: 'manual',
    }
    upstreamResponse = await undiciFetch(input.upstream, init)
  } catch (err) {
    return { upstreamError: formatUpstreamError(err) }
  }

  const resHeadersObj = filterResponseHeaders(upstreamResponse.headers)
  const resHeadersJson = JSON.stringify(redactSensitiveHeaders(headersToRecord(upstreamResponse.headers)))
  const contentType = upstreamResponse.headers.get('content-type') ?? ''
  const isHeaderlessCodex = !contentType && isChatGptCodexResponsesUrl(input.upstream)
  // ChatGPT's Codex endpoint omits Content-Type. Its stream mode still uses
  // SSE, which needs the event scanner for usage and assembled-text logging.
  const isSse = contentType.includes('text/event-stream') || (isHeaderlessCodex && isStreamingRequest(input.body))
  const isJson = contentType.includes('application/json') || (isHeaderlessCodex && !isSse)
  const isBinaryResponse = !isSse && !isJson
  const captureResponseBodies = getPrivacySettings().captureResponseBodies
  const log = (usage: UsageWithClose, streamed: boolean, error: string | null, resBody: string | null) =>
    writeProxyLog({
      startedAt: input.startedAt,
      status: upstreamResponse.status,
      requestClass: input.requestClass,
      method: input.method,
      endpoint: input.endpoint,
      usage,
      streamed,
      error,
      reqHeaders: input.reqHeadersJson,
      reqBody: input.reqBody,
      resHeaders: resHeadersJson,
      resBody,
      keyId: input.keyId,
      reqModel: input.reqModel,
      attribution: input.attribution,
      routing: input.routing,
      credentialInjectionJson: input.credentialInjectionJson,
    })

  if (!upstreamResponse.body) {
    log(nullUsage(input.reqModel), false, null, null)
    return new Response(null, { status: upstreamResponse.status, headers: resHeadersObj })
  }

  const reader = upstreamResponse.body.getReader()
  const decoder = isBinaryResponse ? null : new TextDecoder()
  const sseScanner = isSse ? new SseUsageScanner(input.startedAt) : null
  const responseCapture = decoder ? new BoundedTextCapture() : null
  // A client may hang up while a read is pending (SSE clients often close the
  // socket as soon as they see `data: [DONE]`). cancel() then logs the request;
  // the pending pull must not touch the controller or log a second row --
  // closing a cancelled stream throws "Invalid state: Controller is already
  // closed".
  let cancelled = false
  let logged = false
  const capturedResBody = () => (captureResponseBodies ? (responseCapture?.text() ?? null) : null)
  const partialUsage = () => (sseScanner ? sseScanner.done(Date.now()) : nullUsage(input.reqModel))

  const responseBody = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { value, done } = await reader.read()
        if (cancelled) return
        if (done) {
          controller.close()
          if (decoder) {
            const tail = decoder.decode()
            if (tail) {
              responseCapture?.append(tail)
              if (sseScanner) sseScanner.feed(tail, Date.now())
            }
          }
          const resBody = capturedResBody()
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

          logged = true
          log(usage, isSse, null, resBody)

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
        if (cancelled || logged) return
        controller.error(err)
        const message = errorMessage(err)
        logged = true
        log(partialUsage(), isSse, message, capturedResBody())
      }
    },
    cancel() {
      cancelled = true
      reader.cancel().catch(() => {})
      if (logged) return
      logged = true
      // A client that read the stream to [DONE] got the whole reply.
      log(partialUsage(), isSse, sseScanner?.sawDone ? null : 'Client disconnected', capturedResBody())
    },
  })

  return new Response(responseBody, {
    status: upstreamResponse.status,
    headers: resHeadersObj,
  })
}
