export function buildDirectUpstream(baseUrl: string, endpoint: string, search: string): string {
  const base = new URL(baseUrl)
  const suffix = endpoint === '/v1' ? '' : endpoint.slice('/v1'.length)
  base.pathname = `${base.pathname.replace(/\/$/, '')}${suffix}`
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
