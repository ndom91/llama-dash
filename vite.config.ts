import { execFileSync } from 'node:child_process'
import tailwindcss from '@tailwindcss/vite'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import { defineConfig, type Plugin, type ViteDevServer } from 'vite'

const gitCommit = (() => {
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim()
  } catch {
    return 'unknown'
  }
})()

// The dev server only routes fetch requests into src/server.ts. This forwards
// /v1/realtime WebSocket upgrades to the hook it registers, and leaves every
// other upgrade (Vite HMR) alone.
function realtimeUpgradeDevPlugin(): Plugin {
  return {
    name: 'llama-dash-realtime-upgrade',
    apply: 'serve',
    configureServer(server) {
      server.httpServer?.on('upgrade', (req, socket, head) => {
        if (new URL(req.url ?? '/', 'http://localhost').pathname !== '/v1/realtime') return
        void forwardDevUpgrade(server, req, socket, head)
      })
    },
  }
}

async function forwardDevUpgrade(
  server: ViteDevServer,
  ...args: Parameters<NonNullable<typeof globalThis.__llamaDashUpgrade>>
) {
  // The server entry loads on its first HTTP request, which registers the hook.
  if (!globalThis.__llamaDashUpgrade) {
    const address = server.httpServer?.address()
    if (address && typeof address === 'object') {
      const host = address.family === 'IPv6' ? `[${address.address}]` : address.address
      await fetch(`http://${host}:${address.port}/api/login-meta`).catch(() => null)
    }
  }
  if (!globalThis.__llamaDashUpgrade?.(...args)) args[1].destroy()
}

const config = defineConfig({
  define: {
    __GIT_COMMIT__: JSON.stringify(gitCommit),
  },
  resolve: { tsconfigPaths: true },
  plugins: [
    devtools({
      // Piping echoes server logs to the browser and back in a loop, starving browser connections.
      consolePiping: { enabled: false },
      editor: {
        name: 'macOS open',
        open: async (path) => {
          const { spawn } = await import('node:child_process')

          spawn('open', [path], {
            detached: true,
            stdio: 'ignore',
          }).unref()
        },
      },
    }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
    realtimeUpgradeDevPlugin(),
  ],
})

export default config
