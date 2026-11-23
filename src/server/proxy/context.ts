import type { ApiKey } from '../db/schema.ts'
import { inferenceBackend } from '../inference/backend.ts'
import { getAttributionSettings, getPrivacySettings } from '../admin/settings.ts'
import { extractAttribution, type RequestAttribution } from './attribution.ts'
import {
  applyProxyBodyHeaders,
  applyProxyBodyTransform,
  getProxyForwardBody,
  getProxyLoggedBody,
  prepareProxyBody,
  type ProxyForwardBody,
  type ProxyBodySnapshot,
} from './body.ts'
import { deleteGatewayAuthHeaders, filterRequestHeaders, redactInjectedHeaders } from './headers.ts'
import { proxyRoutingNeedsBody } from './routing.ts'
import type { RoutingOutcome, TransformResult } from './transforms.ts'
import { emptyRoutingOutcome } from './transforms.ts'
import { selectUpstream } from './upstream.ts'
import { canonicalProxyEndpoint } from '../proxy-path.ts'
import { REDACTED_INJECTED_CREDENTIAL } from './credential-placeholders.ts'

export type ProxyContext = {
  request: Request
  startedAt: number
  method: string
  url: URL
  endpoint: string
  defaultUpstream: string
  upstream: string
  reqHeaders: Record<string, string>
  attribution: RequestAttribution
  routingOutcome: RoutingOutcome
  credentialInjectionJson: string | null
  redactedInjectedHeaderNames: Set<string>
  body: ProxyBodySnapshot | null
  keyId: string | null
  keyRow: ApiKey | null
}

export function createProxyContext(request: Request): ProxyContext {
  const method = request.method.toUpperCase()
  const url = new URL(request.url)
  const defaultUpstream = inferenceBackend.defaultProxyUpstream(url.pathname, url.search)
  return {
    request,
    startedAt: Date.now(),
    method,
    url,
    endpoint: canonicalProxyEndpoint(url.pathname),
    defaultUpstream,
    upstream: defaultUpstream,
    reqHeaders: forwardableRequestHeaders(request.headers),
    attribution: extractAttribution(request.headers, getAttributionSettings()),
    routingOutcome: emptyRoutingOutcome(),
    credentialInjectionJson: null,
    redactedInjectedHeaderNames: new Set(),
    body: null,
    keyId: null,
    keyRow: null,
  }
}

export async function prepareBodyForRoutingIfNeeded(ctx: ProxyContext, apiKeyId: string | null) {
  if (proxyRoutingNeedsBody(ctx.method, ctx.endpoint, apiKeyId)) {
    ctx.body = await prepareProxyBody(ctx.request, ctx.method)
  }
}

export async function ensureProxyBody(ctx: ProxyContext) {
  ctx.body ??= await prepareProxyBody(ctx.request, ctx.method)
}

// Changes a query parameter of the forwarded request, keeping other params
// (e.g. autoload=false on /props) as the client sent them.
export function setProxyQueryParam(ctx: ProxyContext, key: string, value: string) {
  ctx.url.searchParams.set(key, value)
  ctx.defaultUpstream = inferenceBackend.defaultProxyUpstream(ctx.url.pathname, ctx.url.search)
  ctx.upstream = ctx.defaultUpstream
}

export function setAuthContext(ctx: ProxyContext, auth: { keyId: string | null; keyRow: ApiKey | null }) {
  ctx.keyId = auth.keyId
  ctx.keyRow = auth.keyRow
}

export function applyTransformResultToContext(ctx: ProxyContext, transform: Extract<TransformResult, { ok: true }>) {
  ctx.body = applyProxyBodyTransform(ctx.body!, transform)
}

export function finalizeRoutingAndBody(ctx: ProxyContext) {
  ctx.upstream = selectUpstream(ctx.defaultUpstream, ctx.routingOutcome, ctx.endpoint, ctx.url.search)
  if (!ctx.body?.hasBody) return
  applyProxyBodyHeaders(ctx.body, ctx.reqHeaders)
}

export function loggedRequestHeaders(ctx: ProxyContext): string {
  return JSON.stringify(
    redactInjectedHeaders(ctx.reqHeaders, ctx.redactedInjectedHeaderNames, REDACTED_INJECTED_CREDENTIAL),
  )
}

export function loggedRequestBody(ctx: ProxyContext): string | null {
  if (!getPrivacySettings().captureRequestBodies) return null
  return ctx.body ? getProxyLoggedBody(ctx.body) : null
}

export function forwardBody(ctx: ProxyContext): ProxyForwardBody {
  return ctx.body ? getProxyForwardBody(ctx.body) : undefined
}

// llama-dash's own API key header identifies the caller to the proxy only; it
// must never reach the upstream provider.
function forwardableRequestHeaders(headers: Headers): Record<string, string> {
  const out = filterRequestHeaders(headers)
  deleteGatewayAuthHeaders(out)
  return out
}
