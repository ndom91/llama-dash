const ONE_YEAR_SECONDS = 31_536_000

export function parseCookieHeader(header: string): Record<string, string> {
  const cookies: Record<string, string> = {}
  for (const part of header.split(';')) {
    const [rawName, ...rawValue] = part.trim().split('=')
    if (!rawName) continue
    cookies[rawName] = decodeURIComponent(rawValue.join('='))
  }
  return cookies
}

export function writeClientCookie(name: string, value: string) {
  // biome-ignore lint/suspicious/noDocumentCookie: Cookie Store API lacks Safari support.
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${ONE_YEAR_SECONDS}; SameSite=Lax`
}
