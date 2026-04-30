import { config } from '../config.ts'
import type { ApiKey } from '../db/schema.ts'
import { getAttributionSettings, getPrivacySettings } from '../admin/settings.ts'
import { extractAttribution } from './attribution.ts'
import {
  applyProxyBodyHeaders,
  applyProxyBodyTransform,
  getProxyForwardBody,
  getProxyLoggedBody,
  prepareProxyBody,
  restoreProxyBodyContentLength,
  type ProxyBodySnapshot,
} from './body.ts'
import { filterRequestHeaders, redactSensitiveHeaders } from './headers.ts'
import { preAuthRoutingNeedsBody, preferPostAuthRouting } from './routing.ts'
import type { RoutingOutcome, TransformResult } from './transforms.ts'
import { emptyRoutingOutcome } from './transforms.ts'
import { selectUpstream } from './upstream.ts'

export type ProxyContext = {
  request: Request
  startedAt: number
  method: string
  url: URL
  endpoint: string
  defaultUpstream: string
  upstream: string
  reqHeaders: Record<string, string>
  attribution: {
    clientName: string | null
    endUserId: string | null
    sessionId: string | null
  }
  routingOutcome: RoutingOutcome
  body: ProxyBodySnapshot | null
  keyId: string | null
  keyRow: ApiKey | null
}

export function createProxyContext(request: Request): ProxyContext {
  const method = request.method.toUpperCase()
  const url = new URL(request.url)
  const defaultUpstream = `${config.llamaSwapUrl}${url.pathname}${url.search}`
  return {
    request,
    startedAt: Date.now(),
    method,
    url,
    endpoint: url.pathname,
    defaultUpstream,
    upstream: defaultUpstream,
    reqHeaders: filterRequestHeaders(request.headers),
    attribution: extractAttribution(request.headers, getAttributionSettings()),
    routingOutcome: emptyRoutingOutcome(),
    body: null,
    keyId: null,
    keyRow: null,
  }
}

export async function prepareBodyBeforeAuthIfNeeded(ctx: ProxyContext) {
  if (preAuthRoutingNeedsBody(ctx.method)) {
    ctx.body = await prepareProxyBody(ctx.request, ctx.method)
  }
}

export async function ensureProxyBody(ctx: ProxyContext) {
  ctx.body ??= await prepareProxyBody(ctx.request, ctx.method)
}

export function setAuthContext(
  ctx: ProxyContext,
  auth: { keyId: string | null; keyRow: ApiKey | null; preAuthRouting: RoutingOutcome },
) {
  ctx.keyId = auth.keyId
  ctx.keyRow = auth.keyRow
  ctx.routingOutcome = auth.preAuthRouting
}

export function applyTransformResultToContext(ctx: ProxyContext, transform: Extract<TransformResult, { ok: true }>) {
  if (!ctx.body) return
  ctx.body = applyProxyBodyTransform(ctx.body, transform)
}

export function finalizeRoutingAndBody(ctx: ProxyContext, preAuthRouting: RoutingOutcome) {
  if (!ctx.body) return
  if (!ctx.body.hasBody) {
    ctx.upstream = selectUpstream(ctx.defaultUpstream, ctx.routingOutcome, ctx.endpoint, ctx.url.search)
    return
  }
  ctx.routingOutcome = preferPostAuthRouting(preAuthRouting, ctx.routingOutcome)
  ctx.upstream = selectUpstream(ctx.defaultUpstream, ctx.routingOutcome, ctx.endpoint, ctx.url.search)
  applyProxyBodyHeaders(ctx.body, ctx.reqHeaders)
  restoreProxyBodyContentLength(ctx.body, ctx.request, ctx.reqHeaders)
}

export function loggedRequestHeaders(ctx: ProxyContext): string {
  return JSON.stringify(redactSensitiveHeaders(ctx.reqHeaders))
}

export function loggedRequestBody(ctx: ProxyContext): string | null {
  if (!getPrivacySettings().captureRequestBodies) return null
  return ctx.body ? getProxyLoggedBody(ctx.body) : null
}

export function forwardBody(ctx: ProxyContext): ReadableStream<Uint8Array> | BodyInit | undefined {
  return ctx.body ? getProxyForwardBody(ctx.body, ctx.request) : undefined
}
