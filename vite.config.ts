import { execFileSync } from 'node:child_process'
import tailwindcss from '@tailwindcss/vite'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

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

const config = defineConfig({
  define: {
    __GIT_COMMIT__: JSON.stringify(gitCommit),
  },
  resolve: { tsconfigPaths: true },
  plugins: [
    devtools({
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
  ],
})

export default config
