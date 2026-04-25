import { config } from '../config.ts'
import { getAttributionSettings } from '../admin/settings.ts'
import { extractAttribution } from './attribution.ts'
import { authenticateRequest } from './auth.ts'
import {
  applyProxyBodyHeaders,
  applyProxyBodyTransform,
  getProxyForwardBody,
  getProxyLoggedBody,
  prepareProxyBody,
  type ProxyBodySnapshot,
} from './body.ts'
import { toErrorBody } from './errors.ts'
import { forwardUpstreamAndLog, nullUsage, writeProxyLog } from './forward.ts'
import { filterRequestHeaders, redactSensitiveHeaders } from './headers.ts'
import { preAuthRoutingNeedsBody, preferPostAuthRouting, shouldPreserveAuthorization } from './routing.ts'
import type { RoutingOutcome } from './transforms.ts'
import { applyTransforms, emptyRoutingOutcome } from './transforms.ts'
import { selectUpstream } from './upstream.ts'

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
  let routingOutcome: RoutingOutcome = emptyRoutingOutcome()
  let body: ProxyBodySnapshot | null = null
  if (preAuthRoutingNeedsBody(method)) {
    body = await prepareProxyBody(request, method)
  }

  const authResult = authenticateRequest(request, endpoint, body?.parsedBody ?? null)
  if (!authResult.ok) {
    const headers = new Headers({ 'content-type': 'application/json' })
    if (authResult.retryAfterMs) {
      headers.set('retry-after', String(Math.ceil(authResult.retryAfterMs / 1000)))
    }
    writeProxyLog({
      startedAt,
      status: authResult.status,
      method,
      endpoint,
      usage: nullUsage(body?.reqModel),
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
  body ??= await prepareProxyBody(request, method)

  if (!body.hasBody) {
    upstream = selectUpstream(defaultUpstream, routingOutcome, endpoint, url.search)
  }

  if (body.hasBody) {
    if (body.parsedBody && (!body.isMultipart || Object.keys(body.parsedBody).length > 0)) {
      const transformResult = applyTransforms(body.parsedBody, {
        keyRow,
        endpoint,
        method,
        skipRouting: false,
        headers: request.headers,
      })
      routingOutcome = transformResult.routing
      if (!transformResult.ok) {
        writeProxyLog({
          startedAt,
          status: transformResult.status,
          method,
          endpoint,
          usage: nullUsage(body.reqModel),
          streamed: false,
          error: transformResult.body.error.message,
          reqHeaders: loggedReqHeaders(),
          reqBody: getProxyLoggedBody(body),
          resHeaders: null,
          resBody: JSON.stringify(transformResult.body),
          keyId,
          attribution,
          routing: routingOutcome,
        })
        return Response.json(toErrorBody(endpoint, transformResult.body), { status: transformResult.status })
      }
      body = applyProxyBodyTransform(body, transformResult)
    }

    routingOutcome = preferPostAuthRouting(authResult.preAuthRouting, routingOutcome)
    upstream = selectUpstream(defaultUpstream, routingOutcome, endpoint, url.search)
    applyProxyBodyHeaders(body, reqHeaders)
  }

  if (!shouldPreserveAuthorization(routingOutcome)) {
    delete reqHeaders.authorization
  }

  const reqHeadersJson = loggedReqHeaders()
  const loggedReqBody = getProxyLoggedBody(body)
  const forwardedResponse = await forwardUpstreamAndLog({
    upstream,
    method,
    headers: reqHeaders,
    body: getProxyForwardBody(body, request),
    hasBody: body.hasBody,
    startedAt,
    endpoint,
    reqModel: body.reqModel,
    reqHeadersJson,
    reqBody: loggedReqBody,
    keyId,
    keyRow,
    attribution,
    routing: routingOutcome,
  })

  if ('upstreamError' in forwardedResponse) {
    writeProxyLog({
      startedAt,
      status: 502,
      method,
      endpoint,
      usage: nullUsage(body.reqModel),
      streamed: false,
      error: forwardedResponse.upstreamError,
      reqHeaders: reqHeadersJson,
      reqBody: loggedReqBody,
      resHeaders: null,
      resBody: null,
      keyId,
      attribution,
      routing: routingOutcome,
    })
    return Response.json(
      toErrorBody(endpoint, {
        error: { message: `Upstream unreachable: ${forwardedResponse.upstreamError}`, type: 'upstream_unreachable' },
      }),
      { status: 502 },
    )
  }

  return forwardedResponse
}
