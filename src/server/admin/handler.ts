import { aliasRoutes } from './routes/aliases.ts'
import { configRoutes } from './routes/config.ts'
import { keyRoutes } from './routes/keys.ts'
import { modelRoutes } from './routes/models.ts'
import { requestRoutes } from './routes/requests.ts'
import { routingRoutes } from './routes/routing.ts'
import { settingRoutes } from './routes/settings.ts'
import { systemRoutes } from './routes/system.ts'
import { error, type Route } from './routes/types.ts'

const routes: Route[] = [
  ...modelRoutes,
  ...requestRoutes,
  ...configRoutes,
  ...routingRoutes,
  ...aliasRoutes,
  ...settingRoutes,
  ...keyRoutes,
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
      return await route.handler(request, match)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return error(502, message)
    }
  }

  return error(404, `No admin route for ${method} ${pathname}`)
}
