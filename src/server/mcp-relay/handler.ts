import { config } from '../config.ts'
import { getMcpRelayBySlug } from '../admin/mcp-relays.ts'
import { getAttributionSettings, getPrivacySettings } from '../admin/settings.ts'
import { MCP_RELAY_ENDPOINT_PREFIX } from '../../lib/mcp-relays.ts'
import { extractAttribution, type RequestAttribution } from '../proxy/attribution.ts'
import { authenticateGatewayRequest } from '../proxy/auth.ts'
import {
  applyCredentialInjection,
  auditToJson,
  REDACTED_INJECTED_CREDENTIAL,
} from '../proxy/credential-placeholders.ts'
import {
  assertContentLengthWithinLimit,
  MAX_PROXY_BODY_BYTES,
  type ProxyForwardBody,
  readLimitedBytes,
} from '../proxy/body.ts'
import { toErrorBody } from '../proxy/errors.ts'
import { forwardUpstreamAndLog, nullUsage, writeProxyLog } from '../proxy/forward.ts'
import {
  deleteGatewayAuthHeaders,
  filterRequestHeaders,
  redactInjectedHeaders,
  redactSensitiveHeaders,
} from '../proxy/headers.ts'
import { emptyRoutingOutcome, type RoutingOutcome } from '../proxy/transforms.ts'
import type { ApiKey } from '../db/schema.ts'
import { errorMessage } from '../error-message.ts'

export async function handleMcpRelayRequest(request: Request): Promise<Response> {
  const startedAt = Date.now()
  const method = request.method.toUpperCase()
  const url = new URL(request.url)
  const slug = relaySlug(url.pathname)
  const endpoint = slug ? `${MCP_RELAY_ENDPOINT_PREFIX}${slug}` : MCP_RELAY_ENDPOINT_PREFIX.slice(0, -1)
  const attribution = extractAttribution(request.headers, getAttributionSettings())
  const headers = filterRequestHeaders(request.headers)
  deleteGatewayAuthHeaders(headers)

  if (!slug) {
    return relayFailure({
      startedAt,
      status: 404,
      method,
      endpoint,
      message: 'MCP relay not found',
      type: 'mcp_relay_not_found',
      reqHeadersJson: JSON.stringify(redactSensitiveHeaders(headers)),
      keyId: null,
      attribution,
      routing: emptyRoutingOutcome(),
    })
  }

  let relay: ReturnType<typeof getMcpRelayBySlug>
  try {
    relay = getMcpRelayBySlug(slug)
  } catch (err) {
    return relayFailure({
      startedAt,
      status: 500,
      method,
      endpoint,
      message: errorMessage(err),
      type: 'mcp_relay_invalid_config',
      reqHeadersJson: JSON.stringify(redactSensitiveHeaders(headers)),
      keyId: null,
      attribution,
      routing: emptyRoutingOutcome(),
    })
  }
  if (!relay?.enabled) {
    return relayFailure({
      startedAt,
      status: 404,
      method,
      endpoint,
      message: `MCP relay ${slug} not found`,
      type: 'mcp_relay_not_found',
      reqHeadersJson: JSON.stringify(redactSensitiveHeaders(headers)),
      keyId: null,
      attribution,
      routing: emptyRoutingOutcome(),
    })
  }

  const auth = authenticateGatewayRequest(request)
  const routing = relayRoutingOutcome(relay)

  if (!auth.ok) {
    return relayFailure({
      startedAt,
      status: auth.status,
      method,
      endpoint,
      message: auth.body.error.message,
      type: auth.body.error.type,
      reqHeadersJson: JSON.stringify(redactSensitiveHeaders(headers)),
      keyId: null,
      attribution,
      routing,
    })
  }

  if (!isRelayAllowedForKey(auth.keyRow, relay.id)) {
    return relayFailure({
      startedAt,
      status: 403,
      method,
      endpoint,
      message: `API key is not allowed to use MCP relay ${slug}`,
      type: 'mcp_relay_forbidden',
      reqHeadersJson: JSON.stringify(redactSensitiveHeaders(headers)),
      keyId: auth.keyId,
      attribution,
      routing,
    })
  }

  const credentialInjection = applyCredentialInjection({
    headers,
    routing,
    encryptionKey: config.credentialEncryptionKey,
  })
  const credentialInjectionJson = auditToJson(credentialInjection.audit)
  const reqHeadersJson = loggedHeaders(headers, credentialInjection.redactedHeaderNames)

  if (!credentialInjection.ok) {
    return relayFailure({
      startedAt,
      status: credentialInjection.status,
      method,
      endpoint,
      message: credentialInjection.message,
      type: credentialInjection.type,
      reqHeadersJson,
      keyId: auth.keyId,
      attribution,
      routing,
      credentialInjectionJson,
    })
  }

  let body: Awaited<ReturnType<typeof relayBody>>
  try {
    body = await relayBody(request, method)
  } catch (err) {
    const message = errorMessage(err)
    return relayFailure({
      startedAt,
      status: 413,
      method,
      endpoint,
      message,
      type: 'request_too_large',
      reqHeadersJson,
      keyId: auth.keyId,
      attribution,
      routing,
      credentialInjectionJson,
    })
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
    requestClass: 'mcp_relay',
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
    return relayFailure({
      startedAt,
      status: 502,
      method,
      endpoint,
      message: `Upstream unreachable: ${forwardedResponse.upstreamError}`,
      type: 'upstream_unreachable',
      reqHeadersJson,
      reqBody: body.loggedBody,
      keyId: auth.keyId,
      attribution,
      routing,
      credentialInjectionJson,
    })
  }

  return forwardedResponse
}

function isRelayAllowedForKey(keyRow: ApiKey | null, relayId: string): boolean {
  if (!keyRow) return false
  try {
    const allowed = JSON.parse(keyRow.allowedMcpRelays) as unknown
    return Array.isArray(allowed) && allowed.includes(relayId)
  } catch {
    return false
  }
}

async function relayBody(
  request: Request,
  method: string,
): Promise<{
  forwardBody: ProxyForwardBody
  hasBody: boolean
  loggedBody: string | null
}> {
  if (!request.body || method === 'GET' || method === 'HEAD') {
    return { forwardBody: undefined, hasBody: false, loggedBody: null }
  }
  assertContentLengthWithinLimit(request.headers)
  if (!getPrivacySettings().captureRequestBodies) {
    return { forwardBody: request.body, hasBody: true, loggedBody: null }
  }
  const bytes = await readLimitedBytes(request, MAX_PROXY_BODY_BYTES)
  const contentType = request.headers.get('content-type') ?? ''
  const canDecode = contentType.includes('application/json') || contentType.startsWith('text/')
  return {
    forwardBody: bytes.buffer,
    hasBody: true,
    loggedBody: canDecode ? new TextDecoder().decode(bytes) : null,
  }
}

function relaySlug(pathname: string): string | null {
  if (!pathname.startsWith(MCP_RELAY_ENDPOINT_PREFIX)) return null
  const rest = pathname.slice(MCP_RELAY_ENDPOINT_PREFIX.length)
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

function relayFailure(input: {
  startedAt: number
  status: number
  method: string
  endpoint: string
  message: string
  type: string
  reqHeadersJson: string
  reqBody?: string | null
  keyId: string | null
  attribution: RequestAttribution
  routing: RoutingOutcome
  credentialInjectionJson?: string | null
}): Response {
  const body = { error: { message: input.message, type: input.type } }
  writeProxyLog({
    startedAt: input.startedAt,
    status: input.status,
    requestClass: 'mcp_relay',
    method: input.method,
    endpoint: input.endpoint,
    usage: nullUsage(),
    streamed: false,
    error: input.message,
    reqHeaders: input.reqHeadersJson,
    reqBody: input.reqBody ?? null,
    resHeaders: null,
    resBody: JSON.stringify(toErrorBody(input.endpoint, body)),
    keyId: input.keyId,
    reqModel: null,
    attribution: input.attribution,
    routing: input.routing,
    credentialInjectionJson: input.credentialInjectionJson,
  })
  return Response.json(toErrorBody(input.endpoint, body), { status: input.status })
}
