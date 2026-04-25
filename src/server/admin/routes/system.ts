import { config } from '../../config.ts'
import { llamaSwap } from '../../llama-swap/client.ts'
import { json, type Route } from './types.ts'

export const systemRoutes: Route[] = [
  {
    method: 'GET',
    pattern: /^\/api\/health$/,
    handler: async () => {
      try {
        const host = new URL(config.llamaSwapUrl).host
        const t0 = performance.now()
        const [health, version] = await Promise.all([llamaSwap.health(), llamaSwap.version()])
        const latencyMs = Math.round(performance.now() - t0)
        return json(200, {
          upstream: { reachable: true, host, health: health.trim(), latencyMs, ...version },
        })
      } catch (err) {
        return json(200, {
          upstream: {
            reachable: false,
            error: err instanceof Error ? err.message : String(err),
          },
        })
      }
    },
  },
]
