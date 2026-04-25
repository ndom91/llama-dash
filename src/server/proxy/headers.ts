const HOP_BY_HOP = new Set([
  'host',
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
])

// Node's fetch (undici) transparently decompresses upstream bodies when we read
// response.body as a ReadableStream. Forwarding `content-encoding: gzip|br|...`
// alongside the already-decoded bytes causes clients to double-decode. Strip
// `content-length` too since the decoded length differs from the upstream header.
const STRIP_RESPONSE_HEADERS = new Set(['content-encoding', 'content-length'])

const SENSITIVE_HEADERS = new Set(['authorization', 'x-api-key', 'proxy-authorization', 'cookie', 'set-cookie'])

export function redactSensitiveHeaders(headers: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(headers)) {
    out[key] = SENSITIVE_HEADERS.has(key.toLowerCase()) ? '[redacted]' : value
  }
  return out
}

export function filterRequestHeaders(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {}
  headers.forEach((value, key) => {
    const lower = key.toLowerCase()
    if (HOP_BY_HOP.has(lower)) return
    if (lower === 'content-length') return
    out[key] = value
  })
  return out
}

export function filterResponseHeaders(upstream: Headers): Headers {
  const out = new Headers()
  upstream.forEach((value, key) => {
    const lower = key.toLowerCase()
    if (HOP_BY_HOP.has(lower)) return
    if (STRIP_RESPONSE_HEADERS.has(lower)) return
    out.set(key, value)
  })
  return out
}

export function headersToRecord(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {}
  headers.forEach((value, key) => {
    if (!HOP_BY_HOP.has(key.toLowerCase())) out[key] = value
  })
  return out
}
