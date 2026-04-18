import type { Plugin } from 'vite'

/**
 * Mounts our Node middleware — proxy at /v1/* and admin API at /api/* — onto
 * the Vite dev server, ahead of TanStack Start's SSR handler.
 *
 * Production packaging (Nitro / Docker image) will need the same handlers
 * wired into the build output; not part of the first-pass scope.
 */
export function llamaDashServer(): Plugin {
  return {
    name: 'llama-dash:server',
    async configureServer(server) {
      const { config } = await import('./config.ts')
      if (config.llamaSwapInsecure) {
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
      }
      const { runMigrations } = await import('./db/migrate.ts')
      runMigrations()

      const { startModelWatcher } = await import('./model-watcher.ts')
      startModelWatcher()

      server.middlewares.use((req, res, next) => {
        const url = req.url ?? ''

        const run = async () => {
          if (url.startsWith('/v1/') || url === '/v1') {
            const { handleProxyRequest } = await import('./proxy/handler.ts')
            await handleProxyRequest(req, res)
            return true
          }
          if (url.startsWith('/api/')) {
            const { handleAdminRequest } = await import('./admin/handler.ts')
            await handleAdminRequest(req, res)
            return true
          }
          return false
        }

        run().then(
          (handled) => {
            if (!handled) next()
          },
          (err) => next(err instanceof Error ? err : new Error(String(err))),
        )
      })
    },
  }
}
