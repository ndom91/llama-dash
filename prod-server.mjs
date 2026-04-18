import { serve } from 'srvx'
import { serveStatic } from 'srvx/static'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const clientDir = join(__dirname, 'dist', 'client')

const serverEntry = await import('./dist/server/server.js')

const staticHandler = serveStatic({ dir: clientDir })

serve({
  port: parseInt(process.env.PORT || '3000', 10),
  hostname: process.env.HOST || '0.0.0.0',
  middleware: [staticHandler],
  async fetch(request) {
    return serverEntry.default.fetch(request)
  },
})
