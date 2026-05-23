import { config } from '../config.ts'
import { getMcpRelayBySlug } from '../admin/mcp-relays.ts'
import { getAttributionSettings, getPrivacySettings } from '../admin/settings.ts'
import { extractAttribution } from '../proxy/attribution.ts'
import { authenticateGatewayRequest } from '../proxy/auth.ts'
import {
  applyCredentialInjection,
  auditToJson,
  REDACTED_INJECTED_CREDENTIAL,
} from '../proxy/credential-placeholders.ts'
import { MAX_PROXY_BODY_BYTES } from '../proxy/body.ts'
import { toErrorBody } from '../proxy/errors.ts'
import { forwardUpstreamAndLog, nullUsage, writeProxyLog } from '../proxy/forward.ts'
import { filterRequestHeaders, redactInjectedHeaders, redactSensitiveHeaders } from '../proxy/headers.ts'
import { emptyRoutingOutcome, type RoutingOutcome } from '../proxy/transforms.ts'

const RELAY_PREFIX = '/mcp-relays/'
const GATEWAY_AUTH_HEADERS = ['x-llama-dash-api-key', 'x-llama-dash-key']

export async function handleMcpRelayRequest(request: Request): Promise<Response> {
  const startedAt = Date.now()
  const method = request.method.toUpperCase()
  const url = new URL(request.url)
  const slug = relaySlug(url.pathname)
  const endpoint = slug ? `${RELAY_PREFIX}${slug}` : RELAY_PREFIX.slice(0, -1)
  const attribution = extractAttribution(request.headers, getAttributionSettings())
  const headers = filterRequestHeaders(request.headers)
  for (const header of GATEWAY_AUTH_HEADERS) deleteHeader(headers, header)

  if (!slug) {
    return relayError({
      startedAt,
      status: 404,
      method,
      endpoint,
      message: 'MCP relay not found',
      type: 'mcp_relay_not_found',
      headers,
      attribution,
    })
  }

  let relay: ReturnType<typeof getMcpRelayBySlug>
  try {
    relay = getMcpRelayBySlug(slug)
  } catch (err) {
    return relayError({
      startedAt,
      status: 500,
      method,
      endpoint,
      message: err instanceof Error ? err.message : String(err),
      type: 'mcp_relay_invalid_config',
      headers,
      attribution,
    })
  }
  if (!relay?.enabled) {
    return relayError({
      startedAt,
      status: 404,
      method,
      endpoint,
      message: `MCP relay ${slug} not found`,
      type: 'mcp_relay_not_found',
      headers,
      attribution,
    })
  }

  const auth = authenticateGatewayRequest(request)
  const routing = relayRoutingOutcome(relay)

  if (!auth.ok) {
    writeProxyLog({
      startedAt,
      status: auth.status,
      method,
      endpoint,
      usage: nullUsage(),
      streamed: false,
      error: auth.body.error.message,
      reqHeaders: JSON.stringify(redactSensitiveHeaders(headers)),
      reqBody: null,
      resHeaders: null,
      resBody: JSON.stringify(toErrorBody(endpoint, auth.body)),
      keyId: null,
      reqModel: null,
      attribution,
      routing,
    })
    return Response.json(toErrorBody(endpoint, auth.body), { status: auth.status })
  }

  const credentialInjection = applyCredentialInjection({
    headers,
    routing,
    encryptionKey: config.credentialEncryptionKey,
  })
  const credentialInjectionJson = auditToJson(credentialInjection.audit)
  const reqHeadersJson = loggedHeaders(headers, credentialInjection.redactedHeaderNames)

  if (!credentialInjection.ok) {
    writeProxyLog({
      startedAt,
      status: credentialInjection.status,
      method,
      endpoint,
      usage: nullUsage(),
      streamed: false,
      error: credentialInjection.message,
      reqHeaders: reqHeadersJson,
      reqBody: null,
      resHeaders: null,
      resBody: null,
      keyId: auth.keyId,
      reqModel: null,
      attribution,
      routing,
      credentialInjectionJson,
    })
    return Response.json(
      toErrorBody(endpoint, { error: { message: credentialInjection.message, type: credentialInjection.type } }),
      { status: credentialInjection.status },
    )
  }

  let body: Awaited<ReturnType<typeof relayBody>>
  try {
    body = await relayBody(request, method)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    writeProxyLog({
      startedAt,
      status: 413,
      method,
      endpoint,
      usage: nullUsage(),
      streamed: false,
      error: message,
      reqHeaders: reqHeadersJson,
      reqBody: null,
      resHeaders: null,
      resBody: null,
      keyId: auth.keyId,
      reqModel: null,
      attribution,
      routing,
      credentialInjectionJson,
    })
    return Response.json(toErrorBody(endpoint, { error: { message, type: 'request_too_large' } }), { status: 413 })
  }
  const target = relayTargetUrl(relay.targetUrl, url.search)
  const forwardedResponse = await forwardUpstreamAndLog({
    upstream: target,
    method,
    headers,
    body: body.forwardBody,
    hasBody: body.hasBody,
    startedAt,
    endpoint,
    reqModel: null,
    reqHeadersJson,
    reqBody: body.loggedBody,
    keyId: auth.keyId,
    keyRow: auth.keyRow,
    attribution,
    routing,
    credentialInjectionJson,
  })

  if ('upstreamError' in forwardedResponse) {
    writeProxyLog({
      startedAt,
      status: 502,
      method,
      endpoint,
      usage: nullUsage(),
      streamed: false,
      error: forwardedResponse.upstreamError,
      reqHeaders: reqHeadersJson,
      reqBody: body.loggedBody,
      resHeaders: null,
      resBody: null,
      keyId: auth.keyId,
      reqModel: null,
      attribution,
      routing,
      credentialInjectionJson,
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

async function relayBody(
  request: Request,
  method: string,
): Promise<{
  forwardBody: ReadableStream<Uint8Array> | BodyInit | undefined
  hasBody: boolean
  loggedBody: string | null
}> {
  if (!request.body || method === 'GET' || method === 'HEAD') {
    return { forwardBody: undefined, hasBody: false, loggedBody: null }
  }
  assertRelayContentLengthWithinLimit(request)
  if (!getPrivacySettings().captureRequestBodies) {
    return { forwardBody: request.body, hasBody: true, loggedBody: null }
  }
  const bytes = await readLimitedBody(request)
  const contentType = request.headers.get('content-type') ?? ''
  const canDecode = contentType.includes('application/json') || contentType.startsWith('text/')
  return {
    forwardBody: bytes,
    hasBody: true,
    loggedBody: canDecode ? new TextDecoder().decode(bytes) : null,
  }
}

async function readLimitedBody(request: Request): Promise<ArrayBuffer> {
  assertRelayContentLengthWithinLimit(request)
  const reader = request.body?.getReader()
  if (!reader) return new ArrayBuffer(0)
  const chunks: Uint8Array[] = []
  let total = 0
  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > MAX_PROXY_BODY_BYTES) {
      await reader.cancel().catch(() => {})
      throw new Error(`Request body exceeds ${MAX_PROXY_BODY_BYTES} bytes`)
    }
    chunks.push(value)
  }

  const combined = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    combined.set(chunk, offset)
    offset += chunk.byteLength
  }
  return combined.buffer
}

function assertRelayContentLengthWithinLimit(request: Request) {
  const rawContentLength = request.headers.get('content-length')
  const contentLength = rawContentLength ? Number(rawContentLength) : null
  if (contentLength != null && Number.isFinite(contentLength) && contentLength > MAX_PROXY_BODY_BYTES) {
    throw new Error(`Request body exceeds ${MAX_PROXY_BODY_BYTES} bytes`)
  }
}

function relaySlug(pathname: string): string | null {
  if (!pathname.startsWith(RELAY_PREFIX)) return null
  const rest = pathname.slice(RELAY_PREFIX.length)
  if (!rest || rest.includes('/')) return null
  return decodeURIComponent(rest)
}

function relayTargetUrl(targetUrl: string, search: string): string {
  const url = new URL(targetUrl)
  url.search = search
  return url.toString()
}

function relayRoutingOutcome(relay: NonNullable<ReturnType<typeof getMcpRelayBySlug>>): RoutingOutcome {
  return {
    ...emptyRoutingOutcome(),
    ruleId: relay.id,
    ruleName: `MCP relay: ${relay.name}`,
    actionType: 'continue',
    authMode: 'require_key',
    targetType: 'direct',
    targetBaseUrl: relay.targetUrl,
    credentialBindings: relay.credentialBindings,
  }
}

function loggedHeaders(headers: Record<string, string>, redactedInjectedHeaderNames: Set<string>): string {
  return JSON.stringify(redactInjectedHeaders(headers, redactedInjectedHeaderNames, REDACTED_INJECTED_CREDENTIAL))
}

function deleteHeader(headers: Record<string, string>, name: string) {
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() === name) delete headers[key]
  }
}

function relayError(input: {
  startedAt: number
  status: number
  method: string
  endpoint: string
  message: string
  type: string
  headers: Record<string, string>
  attribution: { clientName: string | null; endUserId: string | null; sessionId: string | null }
}): Response {
  const body = { error: { message: input.message, type: input.type } }
  writeProxyLog({
    startedAt: input.startedAt,
    status: input.status,
    method: input.method,
    endpoint: input.endpoint,
    usage: nullUsage(),
    streamed: false,
    error: input.message,
    reqHeaders: JSON.stringify(redactSensitiveHeaders(input.headers)),
    reqBody: null,
    resHeaders: null,
    resBody: JSON.stringify(toErrorBody(input.endpoint, body)),
    keyId: null,
    reqModel: null,
    attribution: input.attribution,
    routing: emptyRoutingOutcome(),
  })
  return Response.json(toErrorBody(input.endpoint, body), { status: input.status })
}
