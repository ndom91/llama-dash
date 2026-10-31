import { type ProviderPathJoin, providerEndpointForBaseUrl } from '../../lib/providers.ts'
import { isAllowedDirectUpstream } from '../../lib/schemas/routing-rule.ts'

export function buildDirectUpstream(
  baseUrl: string,
  endpoint: string,
  search: string,
  pathJoin?: ProviderPathJoin,
): string {
  if (!isAllowedDirectUpstream(baseUrl)) {
    throw new Error('Direct upstream host is not on the allowlist')
  }
  const base = new URL(baseUrl)
  const join = pathJoin ?? providerEndpointForBaseUrl(baseUrl)?.pathJoin ?? 'strip-v1'
  if (join === 'keep-v1') {
    // The base URL is a mount point (e.g. `/anthropic`); append the incoming
    // path verbatim so `/v1/messages` lands on `/anthropic/v1/messages`.
    if (endpoint === '/v1') {
      base.pathname = base.pathname.replace(/\/$/, '')
    } else {
      base.pathname = `${base.pathname.replace(/\/$/, '')}${endpoint}`
    }
  } else if (endpoint === '/v1') {
    base.pathname = base.pathname.replace(/\/$/, '')
  } else if (endpoint.startsWith('/v1/')) {
    base.pathname = `${base.pathname.replace(/\/$/, '')}${endpoint.slice('/v1'.length)}`
  } else {
    base.pathname = endpoint
  }
  base.search = search
  return base.toString()
}

export function selectUpstream(
  defaultUpstream: string,
  routing: {
    targetType: string | null
    targetBaseUrl: string | null
    targetPathJoin?: ProviderPathJoin | null
  },
  endpoint: string,
  search: string,
): string {
  if (routing.targetType === 'direct' && routing.targetBaseUrl) {
    return buildDirectUpstream(routing.targetBaseUrl, endpoint, search, routing.targetPathJoin ?? undefined)
  }
  return defaultUpstream
}
