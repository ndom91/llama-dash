import { execFileSync } from 'node:child_process'
import tailwindcss from '@tailwindcss/vite'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const gitCommit = (() => {
  const fromEnv = process.env.GIT_COMMIT?.trim() || process.env.SOURCE_COMMIT?.trim()
  if (fromEnv) return fromEnv.slice(0, 7)
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
      cwd: import.meta.dirname,
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim()
  } catch {
    return ''
  }
})()

const config = defineConfig({
  define: {
    // Empty string when unavailable — UI hides the chip instead of showing "unknown".
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
