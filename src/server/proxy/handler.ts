import { enforceAuth, resolveApiKey } from './auth.ts'
import {
  applyTransformResultToContext,
  createProxyContext,
  ensureProxyBody,
  finalizeRoutingAndBody,
  forwardBody,
  loggedRequestBody,
  loggedRequestHeaders,
  prepareBodyForRoutingIfNeeded,
  setAuthContext,
  type ProxyContext,
} from './context.ts'
import { queueOverflowError, queueTimeoutError, toErrorBody } from './errors.ts'
import { forwardUpstreamAndLog, nullUsage, writeProxyLog } from './forward.ts'
import { getModelScheduler, type ProxyRequestData } from './model-scheduler.ts'
import { createImmediateSseStream, createQueuedSseStream, endpointSupportsProgressTape } from './queue-status-sse.ts'
import { forceUpstreamStream } from './assemble-sse-completion.ts'
import { registerProxyInflight, updateInflight } from './inflight-requests.ts'
import { applyProxyBodyHeaders, applyProxyBodyTransform } from './body.ts'
import { resolveProxyRouting, shouldPreserveAuthorization } from './routing.ts'
import { applyTransforms, routingOutcomeFromDecision } from './transforms.ts'
import { applyCredentialInjection, auditToJson } from './credential-placeholders.ts'
import { config } from '../config.ts'
import { ulid } from 'ulidx'

const HARD_BODY_CAP = 20 * 1024 * 1024

export async function handleProxyRequest(request: Request): Promise<Response> {
  const ctx = createProxyContext(request)

  const contentLength = Number(request.headers.get('content-length') ?? '0')
  if (contentLength > HARD_BODY_CAP) {
    return rejectBodyTooLarge(ctx, new Error('Request body exceeds 20 MB hard limit'))
  }

  // Optimistically resolve the API key from the header (no body read). A valid
  // key is only attached; enforcement happens after routing is decided.
  const keyResolution = resolveApiKey(request)
  const resolvedKeyId = keyResolution.status === 'valid' ? keyResolution.keyRow.id : null

  try {
    await prepareBodyForRoutingIfNeeded(ctx, resolvedKeyId)
  } catch (err) {
    return rejectBodyTooLarge(ctx, err)
  }

  // Single ordered, first-match-wins routing pass with the resolved key. The
  // matched rule's auth mode then governs whether a valid key is required.
  const routingDecision = resolveProxyRouting(
    ctx.endpoint,
    ctx.body?.parsedBody ?? null,
    resolvedKeyId,
    request.headers,
  )
  ctx.routingOutcome = routingOutcomeFromDecision(routingDecision, ctx.body?.reqModel ?? null)

  const authResult = enforceAuth(keyResolution, routingDecision.authMode)
  if (!authResult.ok) {
    const headers = new Headers({ 'content-type': 'application/json' })
    if (authResult.retryAfterMs) {
      headers.set('retry-after', String(Math.ceil(authResult.retryAfterMs / 1000)))
    }
    writeProxyLog({
      id: ctx.requestId,
      startedAt: ctx.startedAt,
      status: authResult.status,
      method: ctx.method,
      endpoint: ctx.endpoint,
      usage: nullUsage(ctx.body?.reqModel),
      streamed: false,
      error: authResult.body.error.message,
      reqHeaders: loggedRequestHeaders(ctx),
      reqBody: null,
      resHeaders: null,
      resBody: JSON.stringify(toErrorBody(ctx.endpoint, authResult.body)),
      keyId: null,
      reqModel: ctx.body?.reqModel ?? null,
      attribution: ctx.attribution,
      routing: ctx.routingOutcome,
      credentialInjectionJson: ctx.credentialInjectionJson,
    })
    return new Response(JSON.stringify(toErrorBody(ctx.endpoint, authResult.body)), {
      status: authResult.status,
      headers,
    })
  }

  setAuthContext(ctx, authResult)
  try {
    await ensureProxyBody(ctx)
  } catch (err) {
    return rejectBodyTooLarge(ctx, err)
  }

  if (ctx.body?.hasBody) {
    if (ctx.body.parsedBody && !ctx.body.isMultipart) {
      const transformResult = applyTransforms(ctx.body.parsedBody, {
        keyRow: ctx.keyRow,
        endpoint: ctx.endpoint,
        method: ctx.method,
        routingDecision,
      })
      ctx.routingOutcome = transformResult.routing
      if (!transformResult.ok) {
        writeProxyLog({
          id: ctx.requestId,
          startedAt: ctx.startedAt,
          status: transformResult.status,
          method: ctx.method,
          endpoint: ctx.endpoint,
          usage: nullUsage(ctx.body.reqModel),
          streamed: false,
          error: transformResult.body.error.message,
          reqHeaders: loggedRequestHeaders(ctx),
          reqBody: loggedRequestBody(ctx),
          resHeaders: null,
          resBody: JSON.stringify(transformResult.body),
          keyId: ctx.keyId,
          reqModel: ctx.body.reqModel,
          attribution: ctx.attribution,
          routing: ctx.routingOutcome,
          credentialInjectionJson: ctx.credentialInjectionJson,
        })
        return Response.json(toErrorBody(ctx.endpoint, transformResult.body), { status: transformResult.status })
      }
      applyTransformResultToContext(ctx, transformResult)
    }
  }

  finalizeRoutingAndBody(ctx)

  if (!shouldPreserveAuthorization(ctx.routingOutcome)) {
    delete ctx.reqHeaders.authorization
  }

  if (usesStoredCredentials(ctx) && !ctx.keyId) {
    const body = {
      error: {
        message: 'Stored credential routing requires a llama-dash API key',
        type: 'credential_key_required',
      },
    }
    writeProxyLog({
      id: ctx.requestId,
      startedAt: ctx.startedAt,
      status: 401,
      method: ctx.method,
      endpoint: ctx.endpoint,
      usage: nullUsage(ctx.body?.reqModel),
      streamed: false,
      error: body.error.message,
      reqHeaders: loggedRequestHeaders(ctx),
      reqBody: loggedRequestBody(ctx),
      resHeaders: null,
      resBody: JSON.stringify(toErrorBody(ctx.endpoint, body)),
      keyId: null,
      reqModel: ctx.body?.reqModel ?? null,
      attribution: ctx.attribution,
      routing: ctx.routingOutcome,
      credentialInjectionJson: ctx.credentialInjectionJson,
    })
    return Response.json(toErrorBody(ctx.endpoint, body), { status: 401 })
  }

  const credentialInjection = applyCredentialInjection({
    headers: ctx.reqHeaders,
    routing: ctx.routingOutcome,
    encryptionKey: config.credentialEncryptionKey,
  })
  ctx.credentialInjectionJson = auditToJson(credentialInjection.audit)
  ctx.redactedInjectedHeaderNames = credentialInjection.redactedHeaderNames
  if (!credentialInjection.ok) {
    writeProxyLog({
      id: ctx.requestId,
      startedAt: ctx.startedAt,
      status: credentialInjection.status,
      method: ctx.method,
      endpoint: ctx.endpoint,
      usage: nullUsage(ctx.body?.reqModel),
      streamed: false,
      error: credentialInjection.message,
      reqHeaders: loggedRequestHeaders(ctx),
      reqBody: loggedRequestBody(ctx),
      resHeaders: null,
      resBody: null,
      keyId: ctx.keyId,
      reqModel: ctx.body?.reqModel ?? null,
      attribution: ctx.attribution,
      routing: ctx.routingOutcome,
      credentialInjectionJson: ctx.credentialInjectionJson,
    })
    return Response.json(
      toErrorBody(ctx.endpoint, {
        error: { message: credentialInjection.message, type: credentialInjection.type },
      }),
      { status: credentialInjection.status },
    )
  }

  const reqHeadersJson = loggedRequestHeaders(ctx)
  const reqBody = loggedRequestBody(ctx)

  const isLocalBackend = ctx.routingOutcome.targetType !== 'direct'
  const clientRequestedSse = ctx.body?.parsedBody?.stream === true
  // Progress SSE tape only when the client asked for streaming on a completion
  // endpoint. Non-stream clients still get JSON — we may force upstream stream
  // and assemble the completion after the SSE finishes.
  const useProgressTape = isLocalBackend && clientRequestedSse && endpointSupportsProgressTape(ctx.endpoint)

  // Local completion + client stream:false → upstream stream:true, assemble JSON.
  let assembleNonStream = false
  if (
    isLocalBackend &&
    !clientRequestedSse &&
    endpointSupportsProgressTape(ctx.endpoint) &&
    ctx.body?.parsedBody &&
    !ctx.body.isMultipart
  ) {
    const forced = forceUpstreamStream(ctx.body.parsedBody)
    if (forced.mutated) {
      assembleNonStream = true
      ctx.body = applyProxyBodyTransform(ctx.body, { body: forced.body, mutated: true })
      applyProxyBodyHeaders(ctx.body, ctx.reqHeaders)
    }
  }

  if (isLocalBackend) {
    const scheduler = getModelScheduler()
    // Queue-entry id is distinct from the logged request id (req_*).
    const entryId = `queue_${ulid()}`
    const model = ctx.body?.reqModel ?? ctx.routingOutcome.routedModel ?? 'unknown'

    registerProxyInflight(ctx, {
      phase: 'accepted',
      streamed: clientRequestedSse ? true : assembleNonStream ? false : null,
    })

    const requestData: ProxyRequestData = {
      id: ctx.requestId,
      upstream: ctx.upstream,
      method: ctx.method,
      headers: ctx.reqHeaders,
      body: forwardBody(ctx),
      hasBody: ctx.body?.hasBody ?? false,
      startedAt: ctx.startedAt,
      earlyCommitAtMs: null,
      enqueueAtMs: null,
      relayedAtMs: null,
      queueMs: 0,
      assembleNonStream,
      endpoint: ctx.endpoint,
      reqModel: ctx.body?.reqModel ?? null,
      reqHeadersJson,
      reqBody,
      keyId: ctx.keyId,
      keyRow: ctx.keyRow,
      attribution: ctx.attribution,
      routing: ctx.routingOutcome,
      credentialInjectionJson: ctx.credentialInjectionJson,
    }

    const enqueueResult = scheduler.enqueue(entryId, model, requestData)

    if (enqueueResult.status === 'queued') {
      updateInflight(ctx.requestId, { phase: 'queued' })
    }

    if (enqueueResult.status === 'overflow') {
      const overflow = queueOverflowError(enqueueResult.queueDepth, enqueueResult.maxQueue)
      writeProxyLog({
        id: ctx.requestId,
        startedAt: ctx.startedAt,
        status: overflow.status,
        method: ctx.method,
        endpoint: ctx.endpoint,
        usage: nullUsage(ctx.body?.reqModel),
        streamed: false,
        error: (overflow.body as any).error?.message ?? 'Queue overflow',
        reqHeaders: reqHeadersJson,
        reqBody,
        resHeaders: null,
        resBody: JSON.stringify(toErrorBody(ctx.endpoint, overflow.body as any)),
        keyId: ctx.keyId,
        reqModel: ctx.body?.reqModel ?? null,
        attribution: ctx.attribution,
        routing: ctx.routingOutcome,
        credentialInjectionJson: ctx.credentialInjectionJson,
        queueMs: 0,
      })
      return new Response(JSON.stringify(toErrorBody(ctx.endpoint, overflow.body as any)), {
        status: overflow.status,
        headers: overflow.headers,
      })
    }

    try {
      if (useProgressTape) {
        // stream:true completion: early-commit SSE, emit `: queued` / `: relayed`,
        // pipe upstream SSE (with `: reason` / `: respond` from forward).
        // Timeout after commit cannot become HTTP 408 — see createQueuedSseStream.
        requestData.earlyCommitAtMs = Date.now()

        if (enqueueResult.status === 'queued') {
          const sseStream = createQueuedSseStream(scheduler, enqueueResult.entryId, model, enqueueResult.waitPromise)
          return new Response(sseStream, {
            status: 200,
            headers: {
              'content-type': 'text/event-stream',
              'cache-control': 'no-cache',
              connection: 'keep-alive',
              'x-llama-dash-queued': 'true',
            },
          })
        }

        const sseStream = createImmediateSseStream(enqueueResult.startDispatch)
        return new Response(sseStream, {
          status: 200,
          headers: {
            'content-type': 'text/event-stream',
            'cache-control': 'no-cache',
            connection: 'keep-alive',
            'x-llama-dash-queued': 'false',
          },
        })
      }

      // Non-stream (and non-completion) local routes: HTTP long-poll.
      // Hold until a slot is acquired, return upstream body unchanged.
      // Queue visibility via response headers for clients (e.g. playground).
      if (enqueueResult.status === 'queued') {
        const upstreamResponse = await enqueueResult.waitPromise
        return withQueueHeaders(upstreamResponse, true, requestData.queueMs ?? 0)
      }
      const upstreamResponse = await enqueueResult.startDispatch()
      return withQueueHeaders(upstreamResponse, false, requestData.queueMs ?? 0)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      const isTimeout = message.includes('Queue timeout')
      if (isTimeout) {
        const timeoutErr = queueTimeoutError(config.localBackendQueueTimeoutMs)
        writeProxyLog({
          id: ctx.requestId,
          startedAt: ctx.startedAt,
          status: timeoutErr.status,
          method: ctx.method,
          endpoint: ctx.endpoint,
          usage: nullUsage(ctx.body?.reqModel),
          streamed: false,
          error: message,
          reqHeaders: reqHeadersJson,
          reqBody,
          resHeaders: null,
          resBody: JSON.stringify(toErrorBody(ctx.endpoint, timeoutErr.body as any)),
          keyId: ctx.keyId,
          reqModel: ctx.body?.reqModel ?? null,
          attribution: ctx.attribution,
          routing: ctx.routingOutcome,
          credentialInjectionJson: ctx.credentialInjectionJson,
          queueMs: config.localBackendQueueTimeoutMs > 0 ? config.localBackendQueueTimeoutMs : null,
        })
        return new Response(JSON.stringify(toErrorBody(ctx.endpoint, timeoutErr.body as any)), {
          status: timeoutErr.status,
          headers: timeoutErr.headers,
        })
      }

      writeProxyLog({
        id: ctx.requestId,
        startedAt: ctx.startedAt,
        status: 502,
        method: ctx.method,
        endpoint: ctx.endpoint,
        usage: nullUsage(ctx.body?.reqModel),
        streamed: false,
        error: message,
        reqHeaders: reqHeadersJson,
        reqBody,
        resHeaders: null,
        resBody: null,
        keyId: ctx.keyId,
        reqModel: ctx.body?.reqModel ?? null,
        attribution: ctx.attribution,
        routing: ctx.routingOutcome,
        credentialInjectionJson: ctx.credentialInjectionJson,
      })
      return Response.json(
        toErrorBody(ctx.endpoint, {
          error: { message, type: 'upstream_error' },
        }),
        { status: 502 },
      )
    }
  }

  registerProxyInflight(ctx, {
    phase: 'active',
    streamed: clientRequestedSse ? true : null,
  })

  const forwardedResponse = await forwardUpstreamAndLog({
    id: ctx.requestId,
    upstream: ctx.upstream,
    method: ctx.method,
    headers: ctx.reqHeaders,
    body: forwardBody(ctx),
    hasBody: ctx.body?.hasBody ?? false,
    startedAt: ctx.startedAt,
    endpoint: ctx.endpoint,
    reqModel: ctx.body?.reqModel ?? null,
    reqHeadersJson,
    reqBody,
    keyId: ctx.keyId,
    keyRow: ctx.keyRow,
    attribution: ctx.attribution,
    routing: ctx.routingOutcome,
    credentialInjectionJson: ctx.credentialInjectionJson,
  })

  if ('upstreamError' in forwardedResponse) {
    writeProxyLog({
      id: ctx.requestId,
      startedAt: ctx.startedAt,
      status: 502,
      method: ctx.method,
      endpoint: ctx.endpoint,
      usage: nullUsage(ctx.body?.reqModel),
      streamed: false,
      error: forwardedResponse.upstreamError,
      reqHeaders: reqHeadersJson,
      reqBody,
      resHeaders: null,
      resBody: null,
      keyId: ctx.keyId,
      reqModel: ctx.body?.reqModel ?? null,
      attribution: ctx.attribution,
      routing: ctx.routingOutcome,
      credentialInjectionJson: ctx.credentialInjectionJson,
    })
    return Response.json(
      toErrorBody(ctx.endpoint, {
        error: { message: `Upstream unreachable: ${forwardedResponse.upstreamError}`, type: 'upstream_unreachable' },
      }),
      { status: 502 },
    )
  }

  return forwardedResponse
}

function usesStoredCredentials(ctx: ProxyContext): boolean {
  return Boolean(ctx.routingOutcome.targetCredentialId) || ctx.routingOutcome.credentialBindings.length > 0
}

/** Attach queue visibility without changing content-type or body framing. */
function withQueueHeaders(response: Response, queued: boolean, queueMs: number): Response {
  const headers = new Headers(response.headers)
  headers.set('x-llama-dash-queued', queued ? 'true' : 'false')
  headers.set('x-llama-dash-queue-ms', String(Math.max(0, Math.round(queueMs))))
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

function rejectBodyTooLarge(ctx: ProxyContext, err: unknown): Response {
  const message = err instanceof Error ? err.message : String(err)
  const body = { error: { message, type: 'request_too_large' } }
  writeProxyLog({
    id: ctx.requestId,
    startedAt: ctx.startedAt,
    status: 413,
    method: ctx.method,
    endpoint: ctx.endpoint,
    usage: nullUsage(),
    streamed: false,
    error: message,
    reqHeaders: loggedRequestHeaders(ctx),
    reqBody: null,
    resHeaders: null,
    resBody: JSON.stringify(toErrorBody(ctx.endpoint, body)),
    keyId: null,
    reqModel: ctx.body?.reqModel ?? null,
    attribution: ctx.attribution,
    routing: ctx.routingOutcome,
    credentialInjectionJson: ctx.credentialInjectionJson,
  })
  return Response.json(toErrorBody(ctx.endpoint, body), { status: 413 })
}
