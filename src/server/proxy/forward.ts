import { Agent, fetch as undiciFetch, type RequestInit as UndiciRequestInit } from 'undici'
import { getPrivacySettings } from '../admin/settings.ts'
import { config } from '../config.ts'
import type { ApiKey } from '../db/schema.ts'
import { SseToJsonCompletionAssembler } from './assemble-sse-completion.ts'
import type { ProxyForwardBody } from './body.ts'
import { headersToRecord, filterResponseHeaders, redactSensitiveHeaders } from './headers.ts'
import { attachLlamaDashTimings, buildLlamaDashTimings } from './llama-dash-timings.ts'
import { writeRequestLog } from './log.ts'
import { recordTokenUsage } from './rate-limiter.ts'
import { BoundedTextCapture } from './text-capture.ts'
import { SseContentAssembler } from './sse-content-assembler.ts'
import type { RoutingOutcome } from './transforms.ts'
import {
  SseUsageScanner,
  type UsageWithClose,
  usageFromJsonBody,
  usageTokenSum,
  usageWithDisplayPhases,
} from './usage.ts'
import { formatReasonComment, formatRespondComment } from './queue-status-sse.ts'

type Attribution = {
  clientName: string | null
  endUserId: string | null
  sessionId: string | null
}

export type ProxyLogInput = {
  /** Prefixed ULID shared with inflight tracking when registered. */
  id?: string
  startedAt: number
  status: number
  requestClass?: 'inference' | 'mcp_relay'
  method: string
  endpoint: string
  usage: UsageWithClose
  streamed: boolean
  error: string | null
  reqHeaders: string | null
  reqBody: string | null
  resHeaders: string | null
  resBody: string | null
  assembledReasoning?: string | null
  assembledResponse?: string | null
  assembledToolCalls?: string | null
  assembledCitations?: string | null
  keyId: string | null
  reqModel: string | null
  attribution: Attribution
  routing: RoutingOutcome
  credentialInjectionJson?: string | null
  /** Time spent in the local-backend concurrency queue before upstream dispatch. */
  queueMs?: number | null
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
    cacheCreationTokens: null,
    cacheReadTokens: null,
    modelLoadingMs: null,
    prefillMs: null,
    reasoningMs: null,
    responseMs: null,
    decodeMs: null,
    streamCloseMs: null,
    gpuPrefillMs: null,
    gpuDecodeMs: null,
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
    id: input.id,
    startedAt: input.startedAt,
    durationMs: Date.now() - input.startedAt,
    requestClass: input.requestClass ?? 'inference',
    method: input.method,
    endpoint: input.endpoint,
    model: loggedModel,
    statusCode: input.status,
    promptTokens: input.usage.promptTokens,
    completionTokens: input.usage.completionTokens,
    cacheCreationTokens: input.usage.cacheCreationTokens,
    cacheReadTokens: input.usage.cacheReadTokens,
    streamed: input.streamed,
    error: input.error,
    requestHeaders: input.reqHeaders,
    requestBody: input.reqBody,
    responseHeaders: input.resHeaders,
    responseBody: input.resBody,
    assembledReasoning: input.assembledReasoning ?? null,
    assembledResponse: input.assembledResponse ?? null,
    assembledToolCalls: input.assembledToolCalls ?? null,
    assembledCitations: input.assembledCitations ?? null,
    streamCloseMs: input.usage.streamCloseMs,
    queueMs: input.queueMs ?? null,
    modelLoadingMs: input.usage.modelLoadingMs,
    prefillMs: input.usage.prefillMs,
    reasoningMs: input.usage.reasoningMs,
    responseMs: input.usage.responseMs,
    decodeMs: input.usage.decodeMs,
    gpuPrefillMs: input.usage.gpuPrefillMs,
    gpuDecodeMs: input.usage.gpuDecodeMs,
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
  requestClass?: 'inference' | 'mcp_relay'
  /** Prefixed ULID shared with inflight tracking when registered. */
  id?: string
  reqModel: string | null
  reqHeadersJson: string
  reqBody: string | null
  keyId: string | null
  keyRow: ApiKey | null
  attribution: Attribution
  routing: RoutingOutcome
  credentialInjectionJson?: string | null
  queueMs?: number | null
  /** Wall ms when `: relayed` was emitted — shared RELAY clock for phase timing. */
  relayedAtMs?: number | null
  /**
   * Client asked for non-stream JSON, but we forced upstream `stream: true`.
   * Drain the SSE, assemble OpenAI/Anthropic JSON, return that to the client.
   */
  assembleNonStream?: boolean
}): Promise<Response | { upstreamError: string }> {
  const dispatchAtMs = input.relayedAtMs ?? Date.now()
  let upstreamResponse: Awaited<ReturnType<typeof undiciFetch>>
  try {
    // `duplex` (streaming request bodies) and `dispatcher` (custom undici
    // timeouts) are not in the standard RequestInit type.
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
  const isSse = contentType.includes('text/event-stream')
  const isJson = contentType.includes('application/json')
  const isBinaryResponse = !isSse && !isJson
  const captureResponseBodies = getPrivacySettings().captureResponseBodies

  if (!upstreamResponse.body) {
    writeProxyLog({
      id: input.id,
      startedAt: input.startedAt,
      status: upstreamResponse.status,
      requestClass: input.requestClass,
      method: input.method,
      endpoint: input.endpoint,
      usage: {
        ...nullUsage(input.reqModel),
      },
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
      credentialInjectionJson: input.credentialInjectionJson,
      queueMs: input.queueMs ?? null,
    })
    return new Response(null, { status: upstreamResponse.status, headers: resHeadersObj })
  }

  // Client wanted JSON; upstream was forced to stream — drain SSE and reassemble.
  if (input.assembleNonStream && isSse) {
    return await assembleUpstreamSseAsJson({
      upstreamResponse,
      reader: upstreamResponse.body.getReader(),
      dispatchAtMs,
      resHeadersObj,
      resHeadersJson,
      captureResponseBodies,
      input,
    })
  }

  const reader = upstreamResponse.body.getReader()
  const decoder = isBinaryResponse ? null : new TextDecoder()
  const encoder = isSse ? new TextEncoder() : null
  const sseScanner = isSse ? new SseUsageScanner(dispatchAtMs) : null
  const contentAssembler = isSse ? new SseContentAssembler() : null
  const responseCapture = decoder ? new BoundedTextCapture() : null

  const finishAssembled = () => (captureResponseBodies ? (contentAssembler?.result() ?? null) : null)

  const serializeToolCalls = (a: ReturnType<SseContentAssembler['result']> | null) =>
    a?.toolCalls ? JSON.stringify(a.toolCalls) : null
  const serializeCitations = (a: ReturnType<SseContentAssembler['result']> | null) =>
    a?.citations ? JSON.stringify(a.citations) : null

  const enqueuePhaseComments = (
    controller: ReadableStreamDefaultController<Uint8Array>,
    newly: { reason: boolean; respond: boolean },
  ) => {
    if (!encoder || !sseScanner) return
    // Emit RELAY-relative offsets only — never wall-clock epoch.
    const offsets = sseScanner.tokenPhaseOffsets()
    if (newly.reason && offsets.reasonMs != null) {
      controller.enqueue(encoder.encode(`${formatReasonComment(offsets.reasonMs)}\n\n`))
    }
    if (newly.respond && offsets.respondMs != null) {
      controller.enqueue(encoder.encode(`${formatRespondComment(offsets.respondMs)}\n\n`))
    }
  }

  const responseBody = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { value, done } = await reader.read()
        if (done) {
          if (decoder) {
            const tail = decoder.decode()
            if (tail) {
              responseCapture?.append(tail)
              if (sseScanner) {
                const at = Date.now()
                enqueuePhaseComments(controller, sseScanner.feed(tail, at))
              }
              contentAssembler?.feed(tail)
            }
          }
          if (sseScanner) {
            const at = Date.now()
            enqueuePhaseComments(controller, sseScanner.flush(at))
          }
          controller.close()
          const resBody = captureResponseBodies ? (responseCapture?.text() ?? null) : null
          const usageBody = responseCapture?.usageText()
          const closeAt = Date.now()
          const usage: UsageWithClose = sseScanner
            ? sseScanner.done(closeAt)
            : isJson && usageBody
              ? usageWithDisplayPhases(usageFromJsonBody(usageBody))
              : nullUsage(input.reqModel)
          const assembled = finishAssembled()

          writeProxyLog({
            id: input.id,
            startedAt: input.startedAt,
            status: upstreamResponse.status,
            requestClass: input.requestClass,
            method: input.method,
            endpoint: input.endpoint,
            usage,
            streamed: isSse,
            error: null,
            reqHeaders: input.reqHeadersJson,
            reqBody: input.reqBody,
            resHeaders: resHeadersJson,
            resBody,
            assembledReasoning: assembled?.reasoning ?? null,
            assembledResponse: assembled?.response ?? null,
            assembledToolCalls: serializeToolCalls(assembled),
            assembledCitations: serializeCitations(assembled),
            keyId: input.keyId,
            reqModel: input.reqModel,
            attribution: input.attribution,
            routing: input.routing,
            credentialInjectionJson: input.credentialInjectionJson,
            queueMs: input.queueMs ?? null,
          })

          const tokenSum = usageTokenSum(usage)
          if (input.keyRow?.rateLimitTpm != null && tokenSum != null) {
            recordTokenUsage(input.keyRow.id, input.keyRow.rateLimitTpm, tokenSum)
          }
          return
        }
        if (decoder && sseScanner && encoder) {
          const text = decoder.decode(value, { stream: true })
          responseCapture?.append(text)
          const at = Date.now()
          enqueuePhaseComments(controller, sseScanner.feed(text, at))
          contentAssembler?.feed(text)
          controller.enqueue(value)
        } else {
          controller.enqueue(value)
          if (decoder) {
            const text = decoder.decode(value, { stream: true })
            responseCapture?.append(text)
          }
        }
      } catch (err) {
        controller.error(err)
        const message = err instanceof Error ? err.message : String(err)
        const assembled = finishAssembled()
        writeProxyLog({
          id: input.id,
          startedAt: input.startedAt,
          status: upstreamResponse.status,
          requestClass: input.requestClass,
          method: input.method,
          endpoint: input.endpoint,
          usage: sseScanner ? sseScanner.done(Date.now()) : nullUsage(input.reqModel),
          streamed: isSse,
          error: message,
          reqHeaders: input.reqHeadersJson,
          reqBody: input.reqBody,
          resHeaders: resHeadersJson,
          resBody: captureResponseBodies ? (responseCapture?.text() ?? null) : null,
          assembledReasoning: assembled?.reasoning ?? null,
          assembledResponse: assembled?.response ?? null,
          assembledToolCalls: serializeToolCalls(assembled),
          assembledCitations: serializeCitations(assembled),
          keyId: input.keyId,
          reqModel: input.reqModel,
          attribution: input.attribution,
          routing: input.routing,
          credentialInjectionJson: input.credentialInjectionJson,
          queueMs: input.queueMs ?? null,
        })
      }
    },
    cancel() {
      reader.cancel().catch(() => {})
      const assembled = finishAssembled()
      writeProxyLog({
        id: input.id,
        startedAt: input.startedAt,
        status: upstreamResponse.status,
        requestClass: input.requestClass,
        method: input.method,
        endpoint: input.endpoint,
        usage: sseScanner ? sseScanner.done(Date.now()) : nullUsage(input.reqModel),
        streamed: isSse,
        error: 'Client disconnected',
        reqHeaders: input.reqHeadersJson,
        reqBody: input.reqBody,
        resHeaders: resHeadersJson,
        resBody: captureResponseBodies ? (responseCapture?.text() ?? null) : null,
        assembledReasoning: assembled?.reasoning ?? null,
        assembledResponse: assembled?.response ?? null,
        assembledToolCalls: serializeToolCalls(assembled),
        assembledCitations: serializeCitations(assembled),
        keyId: input.keyId,
        reqModel: input.reqModel,
        attribution: input.attribution,
        routing: input.routing,
        credentialInjectionJson: input.credentialInjectionJson,
        queueMs: input.queueMs ?? null,
      })
    },
  })

  return new Response(responseBody, {
    status: upstreamResponse.status,
    headers: resHeadersObj,
  })
}

type ForwardInput = {
  id?: string
  startedAt: number
  endpoint: string
  requestClass?: 'inference' | 'mcp_relay'
  method: string
  reqModel: string | null
  reqHeadersJson: string
  reqBody: string | null
  keyId: string | null
  keyRow: ApiKey | null
  attribution: Attribution
  routing: RoutingOutcome
  credentialInjectionJson?: string | null
  queueMs?: number | null
}

/** Drain upstream SSE (forced stream), log with phase timings, return assembled JSON. */
async function assembleUpstreamSseAsJson(opts: {
  upstreamResponse: Awaited<ReturnType<typeof undiciFetch>>
  reader: ReadableStreamDefaultReader<Uint8Array>
  dispatchAtMs: number
  resHeadersObj: Headers
  resHeadersJson: string
  captureResponseBodies: boolean
  input: ForwardInput
}): Promise<Response> {
  const { upstreamResponse, reader, dispatchAtMs, resHeadersJson, captureResponseBodies, input } = opts
  const decoder = new TextDecoder()
  const sseScanner = new SseUsageScanner(dispatchAtMs)
  const contentAssembler = new SseContentAssembler()
  const jsonAssembler = new SseToJsonCompletionAssembler()
  const responseCapture = new BoundedTextCapture()

  const serializeToolCalls = (a: ReturnType<SseContentAssembler['result']> | null) =>
    a?.toolCalls ? JSON.stringify(a.toolCalls) : null
  const serializeCitations = (a: ReturnType<SseContentAssembler['result']> | null) =>
    a?.citations ? JSON.stringify(a.citations) : null

  let streamError: string | null = null
  try {
    for (;;) {
      const { value, done } = await reader.read()
      if (done) {
        const tail = decoder.decode()
        if (tail) {
          responseCapture.append(tail)
          const at = Date.now()
          sseScanner.feed(tail, at)
          contentAssembler.feed(tail)
          jsonAssembler.feed(tail)
        }
        sseScanner.flush(Date.now())
        break
      }
      const text = decoder.decode(value, { stream: true })
      responseCapture.append(text)
      const at = Date.now()
      sseScanner.feed(text, at)
      contentAssembler.feed(text)
      jsonAssembler.feed(text)
    }
  } catch (err) {
    streamError = err instanceof Error ? err.message : String(err)
  }

  const closeAt = Date.now()
  const usage = sseScanner.done(closeAt)
  const phaseOffsets = sseScanner.tokenPhaseOffsets()
  const assembled = captureResponseBodies ? contentAssembler.result() : null
  const jsonResult = jsonAssembler.result(input.endpoint)
  const llamaDashTimings = buildLlamaDashTimings({
    queueMs: input.queueMs,
    reasonMs: phaseOffsets.reasonMs,
    respondMs: phaseOffsets.respondMs,
    usage,
  })
  const jsonBody = jsonResult
    ? attachLlamaDashTimings(jsonResult.body, llamaDashTimings)
    : {
        error: {
          message: streamError ?? 'Failed to assemble non-stream completion from upstream SSE',
          type: 'assemble_error',
        },
      }
  const resBodyText = JSON.stringify(jsonBody)
  const status = jsonResult ? upstreamResponse.status : 502

  writeProxyLog({
    id: input.id,
    startedAt: input.startedAt,
    status,
    requestClass: input.requestClass,
    method: input.method,
    endpoint: input.endpoint,
    usage,
    // Client-facing exchange was non-stream JSON.
    streamed: false,
    error: streamError,
    reqHeaders: input.reqHeadersJson,
    reqBody: input.reqBody,
    resHeaders: resHeadersJson,
    resBody: captureResponseBodies ? resBodyText : null,
    assembledReasoning: assembled?.reasoning ?? null,
    assembledResponse: assembled?.response ?? null,
    assembledToolCalls: serializeToolCalls(assembled),
    assembledCitations: serializeCitations(assembled),
    keyId: input.keyId,
    reqModel: input.reqModel,
    attribution: input.attribution,
    routing: input.routing,
    credentialInjectionJson: input.credentialInjectionJson,
    queueMs: input.queueMs ?? null,
  })

  const tokenSum = usageTokenSum(usage)
  if (input.keyRow?.rateLimitTpm != null && tokenSum != null) {
    recordTokenUsage(input.keyRow.id, input.keyRow.rateLimitTpm, tokenSum)
  }

  const headers = new Headers(opts.resHeadersObj)
  headers.delete('content-type')
  headers.set('content-type', 'application/json')
  headers.delete('transfer-encoding')
  // Recalculated below by Response / fetch consumers; avoid stale SSE length.
  headers.delete('content-length')
  // Phase offsets from RELAY so non-stream clients can reconstruct REASON/RESPOND.
  if (phaseOffsets.reasonMs != null) headers.set('x-llama-dash-reason-ms', String(phaseOffsets.reasonMs))
  if (phaseOffsets.respondMs != null) headers.set('x-llama-dash-respond-ms', String(phaseOffsets.respondMs))

  return new Response(resBodyText, { status, headers })
}
