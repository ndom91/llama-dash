import { config } from '../config.ts'
import { getMcpRelayBySlug } from '../admin/mcp-relays.ts'
import { getAttributionSettings } from '../admin/settings.ts'
import { extractAttribution } from '../proxy/attribution.ts'
import { authenticateGatewayRequest } from '../proxy/auth.ts'
import {
  applyCredentialInjection,
  auditToJson,
  REDACTED_INJECTED_CREDENTIAL,
} from '../proxy/credential-placeholders.ts'
import { toErrorBody } from '../proxy/errors.ts'
import { forwardUpstreamAndLog, nullUsage, writeProxyLog } from '../proxy/forward.ts'
import { filterRequestHeaders, redactSensitiveHeaders } from '../proxy/headers.ts'
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

  if (!slug) return errorResponse(404, 'MCP relay not found')

  let relay: ReturnType<typeof getMcpRelayBySlug>
  try {
    relay = getMcpRelayBySlug(slug)
  } catch (err) {
    return errorResponse(500, err instanceof Error ? err.message : String(err))
  }
  if (!relay?.enabled) return errorResponse(404, `MCP relay ${slug} not found`)

  const auth = authenticateGatewayRequest(request)
  const routing = relayRoutingOutcome(relay)
  const headers = filterRequestHeaders(request.headers)
  for (const header of GATEWAY_AUTH_HEADERS) deleteHeader(headers, header)

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

  const target = relayTargetUrl(relay.targetUrl, url.search)
  const forwardedResponse = await forwardUpstreamAndLog({
    upstream: target,
    method,
    headers,
    body: request.body ?? undefined,
    hasBody: request.body != null && method !== 'GET' && method !== 'HEAD',
    startedAt,
    endpoint,
    reqModel: null,
    reqHeadersJson,
    reqBody: null,
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
      toErrorBody(endpoint, {
        error: { message: `Upstream unreachable: ${forwardedResponse.upstreamError}`, type: 'upstream_unreachable' },
      }),
      { status: 502 },
    )
  }

  return forwardedResponse
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
  const redacted = redactSensitiveHeaders(headers)
  for (const name of redactedInjectedHeaderNames) {
    for (const key of Object.keys(redacted)) {
      if (key.toLowerCase() === name) redacted[key] = REDACTED_INJECTED_CREDENTIAL
    }
  }
  return JSON.stringify(redacted)
}

function deleteHeader(headers: Record<string, string>, name: string) {
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() === name) delete headers[key]
  }
}

function errorResponse(status: number, message: string): Response {
  return Response.json({ error: { message } }, { status })
}
