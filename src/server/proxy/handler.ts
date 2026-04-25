import { config } from '../config.ts'
import { getAttributionSettings } from '../admin/settings.ts'
import { extractAttribution } from './attribution.ts'
import { authenticateRequest } from './auth.ts'
import { prepareProxyBody } from './body.ts'
import { toErrorBody } from './errors.ts'
import { forwardUpstreamAndLog, nullUsage, writeProxyLog } from './forward.ts'
import { filterRequestHeaders, redactSensitiveHeaders } from './headers.ts'
import { preferPostAuthRouting, shouldPreserveAuthorization } from './routing.ts'
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
    writeProxyLog({
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
        writeProxyLog({
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
        writeProxyLog({
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

  const reqHeadersJson = loggedReqHeaders()
  const loggedReqBody = isMultipart ? null : reqBodyText
  const forwardedResponse = await forwardUpstreamAndLog({
    upstream,
    method,
    headers: reqHeaders,
    body: fetchBody,
    hasBody,
    startedAt,
    endpoint,
    reqModel,
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
      usage: nullUsage(reqModel),
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
