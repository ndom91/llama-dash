import { createStartHandler, defaultStreamHandler } from '@tanstack/react-start/server'
import { createServerEntry } from '@tanstack/react-start/server-entry'
import { config } from './server/config.ts'

if (config.llamaSwapInsecure) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
}

const { auth, getDashboardSession } = await import('./server/auth.ts')

const { ensureSystemKey } = await import('./server/admin/api-keys.ts')
ensureSystemKey()

const { startModelWatcher } = await import('./server/model-watcher.ts')
startModelWatcher()

const { startGpuPoller } = await import('./server/gpu-poller.ts')
startGpuPoller()

const ssrHandler = createStartHandler(defaultStreamHandler)

export default createServerEntry({
  async fetch(request, ...args) {
    const url = new URL(request.url)

    if (url.pathname.startsWith('/api/auth/')) {
      return auth.handler(request)
    }

    if (url.pathname.startsWith('/v1/') || url.pathname === '/v1') {
      const { handleProxyRequest } = await import('./server/proxy/handler.ts')
      return handleProxyRequest(request)
    }

    if (url.pathname.startsWith('/api/')) {
      const session = await getDashboardSession(request)
      if (!session) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'content-type': 'application/json' },
        })
      }
      const { handleAdminRequest } = await import('./server/admin/handler.ts')
      return handleAdminRequest(request)
    }

    if (url.pathname === '/metrics') {
      const { renderPrometheusMetrics } = await import('./server/metrics.ts')
      return new Response(await renderPrometheusMetrics(), {
        headers: { 'content-type': 'text/plain; version=0.0.4; charset=utf-8' },
      })
    }

    if (url.pathname !== '/login') {
      const session = await getDashboardSession(request)
      if (!session) {
        const redirectTo = new URL('/login', url)
        redirectTo.searchParams.set('redirect', `${url.pathname}${url.search}`)
        return Response.redirect(redirectTo, 302)
      }
    }

    return ssrHandler(request, ...args)
  },
})
