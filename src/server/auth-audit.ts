import { dash } from '@better-auth/infra'

const AUDIT_LOG_API_URL = 'http://llama-dash.localhost/better-auth-audit'
const AUDIT_LOG_API_KEY = 'llama-dash-local-audit-logger'

let installed = false

export function authAuditLogger() {
  installAuditFetchLogger()
  return dash({ apiUrl: AUDIT_LOG_API_URL, kvUrl: AUDIT_LOG_API_URL, apiKey: AUDIT_LOG_API_KEY })
}

function installAuditFetchLogger() {
  if (installed) return
  installed = true

  const originalFetch = globalThis.fetch

  globalThis.fetch = async (input, init) => {
    const url = typeof input === 'string' || input instanceof URL ? String(input) : input.url
    if (url === `${AUDIT_LOG_API_URL}/events/track`) {
      const body = parseAuditBody(init?.body)
      console.info('[better-auth:audit]', JSON.stringify(body))
      return Response.json({ ok: true })
    }
    if (url.startsWith(`${AUDIT_LOG_API_URL}/identify/`)) {
      return Response.json(null)
    }
    return originalFetch(input, init)
  }
}

function parseAuditBody(body: BodyInit | null | undefined) {
  if (typeof body !== 'string') return body ?? null

  try {
    return JSON.parse(body) as unknown
  } catch {
    return body
  }
}
