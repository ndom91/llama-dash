import { aliasRoutes } from './routes/aliases.ts'
import { configRoutes } from './routes/config.ts'
import { keyRoutes } from './routes/keys.ts'
import { mcpRelayRoutes } from './routes/mcp-relays.ts'
import { modelRoutes } from './routes/models.ts'
import { requestRoutes } from './routes/requests.ts'
import { routingRoutes } from './routes/routing.ts'
import { settingRoutes } from './routes/settings.ts'
import { systemRoutes } from './routes/system.ts'
import { error, type Route } from './routes/types.ts'
import { upstreamCredentialRoutes } from './routes/upstream-credentials.ts'

const routes: Route[] = [
  ...modelRoutes,
  ...requestRoutes,
  ...configRoutes,
  ...routingRoutes,
  ...aliasRoutes,
  ...settingRoutes,
  ...keyRoutes,
  ...mcpRelayRoutes,
  ...upstreamCredentialRoutes,
  ...systemRoutes,
]

export async function handleAdminRequest(request: Request): Promise<Response> {
  const method = request.method.toUpperCase()
  const pathname = new URL(request.url).pathname

  for (const route of routes) {
    if (route.method !== method) continue
    const match = pathname.match(route.pattern)
    if (!match) continue
    try {
      return withConditionalGet(request, await route.handler(request, match))
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return error(502, message)
    }
  }

  return error(404, `No admin route for ${method} ${pathname}`)
}

async function withConditionalGet(request: Request, response: Response): Promise<Response> {
  if (request.method.toUpperCase() !== 'GET' || response.status !== 200) return response
  if (response.headers.get('cache-control')?.includes('no-store')) return response
  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.includes('application/json')) return response

  const body = await response.text()
  const etag = makeWeakEtag(body)
  if (etagMatches(request.headers.get('if-none-match'), etag)) {
    return new Response(null, {
      status: 304,
      headers: { etag, 'cache-control': 'no-cache' },
    })
  }

  const headers = new Headers(response.headers)
  headers.set('etag', etag)
  headers.set('cache-control', 'no-cache')
  headers.set('content-length', String(new TextEncoder().encode(body).byteLength))
  return new Response(body, { status: response.status, statusText: response.statusText, headers })
}

function makeWeakEtag(body: string) {
  let hash = 0x811c9dc5
  for (let i = 0; i < body.length; i += 1) {
    hash ^= body.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return `W/"${body.length.toString(16)}-${(hash >>> 0).toString(16)}"`
}

function etagMatches(header: string | null, etag: string) {
  if (!header) return false
  return header
    .split(',')
    .map((value) => value.trim())
    .some((value) => value === etag || value === '*')
}
