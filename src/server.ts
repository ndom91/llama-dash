import { createStartHandler, defaultStreamHandler } from '@tanstack/react-start/server'
import { createServerEntry } from '@tanstack/react-start/server-entry'
import { config } from './server/config.ts'

if (config.llamaSwapInsecure) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
}

const { runMigrations } = await import('./server/db/migrate.ts')
runMigrations()

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

    if (url.pathname.startsWith('/v1/') || url.pathname === '/v1') {
      const { handleProxyRequest } = await import('./server/proxy/handler.ts')
      return handleProxyRequest(request)
    }

    if (url.pathname.startsWith('/api/')) {
      const { handleAdminRequest } = await import('./server/admin/handler.ts')
      return handleAdminRequest(request)
    }

    return ssrHandler(request, ...args)
  },
})
