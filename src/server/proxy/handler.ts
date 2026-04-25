import { authenticateRequest } from './auth.ts'
import {
  applyTransformResultToContext,
  createProxyContext,
  ensureProxyBody,
  finalizeRoutingAndBody,
  forwardBody,
  loggedRequestBody,
  loggedRequestHeaders,
  prepareBodyBeforeAuthIfNeeded,
  setAuthContext,
  type ProxyContext,
} from './context.ts'
import { toErrorBody } from './errors.ts'
import { forwardUpstreamAndLog, nullUsage, writeProxyLog } from './forward.ts'
import { shouldPreserveAuthorization } from './routing.ts'
import { applyTransforms } from './transforms.ts'

export async function handleProxyRequest(request: Request): Promise<Response> {
  const ctx = createProxyContext(request)
  try {
    await prepareBodyBeforeAuthIfNeeded(ctx)
  } catch (err) {
    return rejectBodyTooLarge(ctx, err)
  }

  const authResult = authenticateRequest(request, ctx.endpoint, ctx.body?.parsedBody ?? null)
  if (!authResult.ok) {
    const headers = new Headers({ 'content-type': 'application/json' })
    if (authResult.retryAfterMs) {
      headers.set('retry-after', String(Math.ceil(authResult.retryAfterMs / 1000)))
    }
    writeProxyLog({
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
      attribution: ctx.attribution,
      routing: ctx.routingOutcome,
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
    if (ctx.body.parsedBody && (!ctx.body.isMultipart || Object.keys(ctx.body.parsedBody).length > 0)) {
      const transformResult = applyTransforms(ctx.body.parsedBody, {
        keyRow: ctx.keyRow,
        endpoint: ctx.endpoint,
        method: ctx.method,
        skipRouting: false,
        headers: request.headers,
      })
      ctx.routingOutcome = transformResult.routing
      if (!transformResult.ok) {
        writeProxyLog({
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
          attribution: ctx.attribution,
          routing: ctx.routingOutcome,
        })
        return Response.json(toErrorBody(ctx.endpoint, transformResult.body), { status: transformResult.status })
      }
      applyTransformResultToContext(ctx, transformResult)
    }
  }

  finalizeRoutingAndBody(ctx, authResult.preAuthRouting)

  if (!shouldPreserveAuthorization(ctx.routingOutcome)) {
    delete ctx.reqHeaders.authorization
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
  })

  if ('upstreamError' in forwardedResponse) {
    writeProxyLog({
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
      attribution: ctx.attribution,
      routing: ctx.routingOutcome,
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

function rejectBodyTooLarge(ctx: ProxyContext, err: unknown): Response {
  const message = err instanceof Error ? err.message : String(err)
  const body = { error: { message, type: 'request_too_large' } }
  writeProxyLog({
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
    attribution: ctx.attribution,
    routing: ctx.routingOutcome,
  })
  return Response.json(toErrorBody(ctx.endpoint, body), { status: 413 })
}
