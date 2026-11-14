import { serve } from 'srvx'
import { serveStatic } from 'srvx/static'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const clientDir = join(__dirname, 'dist', 'client')

const serverEntry = await import('./dist/server/server.js')

const staticHandler = serveStatic({ dir: clientDir })

const server = serve({
  port: parseInt(process.env.PORT || '3000', 10),
  hostname: process.env.HOST || '0.0.0.0',
  middleware: [staticHandler],
  async fetch(request) {
    return serverEntry.default.fetch(request)
  },
})

// The fetch handler can't accept WebSockets, so /v1/realtime upgrades are
// handed to the hook that the server bundle registers.
server.node?.server?.on('upgrade', (req, socket, head) => {
  if (globalThis.__llamaDashUpgrade?.(req, socket, head)) return
  socket.destroy()
})
