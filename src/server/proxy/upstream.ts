import { isAllowedDirectUpstream } from '../../lib/schemas/routing-rule.ts'

export function buildDirectUpstream(baseUrl: string, endpoint: string, search: string): string {
  if (!isAllowedDirectUpstream(baseUrl)) {
    throw new Error('Direct upstreams are currently limited to api.openai.com and api.anthropic.com')
  }
  const base = new URL(baseUrl)
  if (endpoint === '/v1') {
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
  routing: { targetType: string | null; targetBaseUrl: string | null },
  endpoint: string,
  search: string,
): string {
  if (routing.targetType === 'direct' && routing.targetBaseUrl) {
    return buildDirectUpstream(routing.targetBaseUrl, endpoint, search)
  }
  return defaultUpstream
}
