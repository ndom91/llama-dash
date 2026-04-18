import { execFileSync } from 'node:child_process'
import tailwindcss from '@tailwindcss/vite'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const gitCommit = execFileSync('git', ['rev-parse', '--short', 'HEAD']).toString().trim()

const config = defineConfig({
  define: {
    __GIT_COMMIT__: JSON.stringify(gitCommit),
  },
  resolve: { tsconfigPaths: true },
  plugins: [devtools(), tailwindcss(), tanstackStart(), viteReact()],
})

export default config
