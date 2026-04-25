export function buildDirectUpstream(baseUrl: string, endpoint: string, search: string): string {
  const base = new URL(baseUrl)
  const suffix = endpoint === '/v1' ? '' : endpoint.slice('/v1'.length)
  base.pathname = `${base.pathname.replace(/\/$/, '')}${suffix}`
  base.search = search
  return base.toString()
}
