import { config } from '../../config.ts'
import { databasePathInfo } from '../../db/index.ts'
import { getGpuSnapshot } from '../../gpu-poller.ts'
import { llamaSwap } from '../../llama-swap/client.ts'
import { getRequestLogQueueStats } from '../../proxy/log.ts'
import { json, type Route } from './types.ts'

const DIRECT_TARGETS = ['https://api.openai.com/v1', 'https://api.anthropic.com/v1']

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
  {
    method: 'GET',
    pattern: /^\/api\/system$/,
    handler: async () => {
      const upstreamUrl = new URL(config.llamaSwapUrl)
      const gpu = getGpuSnapshot()
      const now = Date.now()
      return json(200, {
        runtime: {
          uptimeSec: Math.round(process.uptime()),
          nodeVersion: process.version,
          gitCommit: typeof __GIT_COMMIT__ === 'string' ? __GIT_COMMIT__ : 'unknown',
        },
        database: {
          path: databasePathInfo.filename,
          specialPath: !databasePathInfo.needsDirectory,
        },
        proxy: {
          upstreamBaseUrl: config.llamaSwapUrl,
          upstreamHost: upstreamUrl.host,
          insecureTls: config.llamaSwapInsecure,
          directTargets: DIRECT_TARGETS,
        },
        logging: getRequestLogQueueStats(),
        gpu: {
          available: gpu.available,
          driver: gpu.driver,
          gpuCount: gpu.gpus.length,
          polledAt: gpu.polledAt,
          ageMs: gpu.polledAt > 0 ? now - gpu.polledAt : null,
        },
      })
    },
  },
]
