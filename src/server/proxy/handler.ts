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
import { toErrorBody } from './errors.ts'
import { forwardUpstreamAndLog, nullUsage, writeProxyLog } from './forward.ts'
import { resolveProxyRouting, shouldPreserveAuthorization } from './routing.ts'
import { applyTransforms, routingOutcomeFromDecision } from './transforms.ts'
import { applyCredentialInjection, auditToJson } from './credential-placeholders.ts'
import { config } from '../config.ts'
import { errorMessage } from '../error-message.ts'

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

  // Matched rule's auth mode decides whether a valid key is required.
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
    logRejection(ctx, {
      status: authResult.status,
      error: authResult.body.error.message,
      reqBody: null,
      resBody: JSON.stringify(toErrorBody(ctx.endpoint, authResult.body)),
      keyId: null,
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
        logRejection(ctx, {
          status: transformResult.status,
          error: transformResult.body.error.message,
          reqBody: loggedRequestBody(ctx),
          resBody: JSON.stringify(transformResult.body),
          keyId: ctx.keyId,
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
    logRejection(ctx, {
      status: 401,
      error: body.error.message,
      reqBody: loggedRequestBody(ctx),
      resBody: JSON.stringify(toErrorBody(ctx.endpoint, body)),
      keyId: null,
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
    logRejection(ctx, {
      status: credentialInjection.status,
      error: credentialInjection.message,
      reqBody: loggedRequestBody(ctx),
      resBody: null,
      keyId: ctx.keyId,
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
  const forwardedResponse = await forwardUpstreamAndLog({
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
    logRejection(ctx, {
      status: 502,
      error: forwardedResponse.upstreamError,
      reqHeaders: reqHeadersJson,
      reqBody,
      resBody: null,
      keyId: ctx.keyId,
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

// Logs a request the proxy answered itself without a successful upstream exchange.
function logRejection(
  ctx: ProxyContext,
  input: {
    status: number
    error: string
    reqHeaders?: string
    reqBody: string | null
    resBody: string | null
    keyId: string | null
  },
) {
  const reqModel = ctx.body?.reqModel ?? null
  writeProxyLog({
    startedAt: ctx.startedAt,
    status: input.status,
    method: ctx.method,
    endpoint: ctx.endpoint,
    usage: nullUsage(reqModel),
    streamed: false,
    error: input.error,
    reqHeaders: input.reqHeaders ?? loggedRequestHeaders(ctx),
    reqBody: input.reqBody,
    resHeaders: null,
    resBody: input.resBody,
    keyId: input.keyId,
    reqModel,
    attribution: ctx.attribution,
    routing: ctx.routingOutcome,
    credentialInjectionJson: ctx.credentialInjectionJson,
  })
}

function usesStoredCredentials(ctx: ProxyContext): boolean {
  return Boolean(ctx.routingOutcome.targetCredentialId) || ctx.routingOutcome.credentialBindings.length > 0
}

function rejectBodyTooLarge(ctx: ProxyContext, err: unknown): Response {
  const message = errorMessage(err)
  const body = { error: { message, type: 'request_too_large' } }
  logRejection(ctx, {
    status: 413,
    error: message,
    reqBody: null,
    resBody: JSON.stringify(toErrorBody(ctx.endpoint, body)),
    keyId: null,
  })
  return Response.json(toErrorBody(ctx.endpoint, body), { status: 413 })
}
