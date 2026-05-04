import { hasDashboardUsers } from '../../auth.ts'
import { config } from '../../config.ts'
import { databasePathInfo } from '../../db/index.ts'
import { getGpuSnapshot } from '../../gpu-poller.ts'
import { inferenceBackend } from '../../inference/backend.ts'
import { getRequestLogQueueStats } from '../../proxy/log.ts'
import { json, type Route } from './types.ts'

const DIRECT_TARGETS = ['https://api.openai.com/v1', 'https://api.anthropic.com/v1']

export const systemRoutes: Route[] = [
  {
    method: 'GET',
    pattern: /^\/api\/health$/,
    handler: async () => {
      const health = await inferenceBackend.health()
      return json(200, {
        upstream: { ...health, backend: inferenceBackend.info.label, host: inferenceBackend.info.upstreamHost },
      })
    },
  },
  {
    method: 'GET',
    pattern: /^\/api\/system$/,
    handler: async () => {
      const backend = inferenceBackend.info
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
          upstreamBaseUrl: backend.upstreamBaseUrl,
          upstreamHost: backend.upstreamHost,
          insecureTls: config.inferenceInsecure,
          directTargets: DIRECT_TARGETS,
        },
        inference: {
          kind: backend.kind,
          label: backend.label,
          capabilities: backend.capabilities,
        },
        logging: getRequestLogQueueStats(),
        gpu: {
          available: gpu.available,
          driver: gpu.driver,
          gpuCount: gpu.gpus.length,
          polledAt: gpu.polledAt,
          ageMs: gpu.polledAt > 0 ? now - gpu.polledAt : null,
          gpus: gpu.gpus,
        },
      })
    },
  },
  {
    method: 'GET',
    pattern: /^\/api\/login-meta$/,
    handler: async (request) => {
      const publicUrl = getPublicUrl(request)
      return json(200, {
        instanceLabel: publicUrl.host || 'local instance',
        uptimeLabel: formatLoginUptime(Math.round(process.uptime())),
        commitLabel: formatLoginCommit(typeof __GIT_COMMIT__ === 'string' ? __GIT_COMMIT__ : 'unknown'),
        tlsLabel: publicUrl.protocol === 'https:' ? 'https · tls' : 'http · no tls',
        signupAllowed: !hasDashboardUsers(),
      })
    },
  },
]

function getPublicUrl(request: Request) {
  const url = new URL(request.url)
  const forwardedProto = firstForwardedValue(request.headers.get('x-forwarded-proto'))
  const forwardedHost = firstForwardedValue(request.headers.get('x-forwarded-host'))
  const host = forwardedHost ?? request.headers.get('host')

  if (forwardedProto) url.protocol = forwardedProto.endsWith(':') ? forwardedProto : `${forwardedProto}:`
  if (host) url.host = host

  return url
}

function firstForwardedValue(value: string | null) {
  return value?.split(',')[0]?.trim() || null
}

function formatLoginUptime(seconds: number) {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  if (hours > 0) return `up · ${hours}h ${minutes}m`
  return `up · ${minutes}m`
}

function formatLoginCommit(commit: string) {
  if (commit === 'unknown') return commit
  return commit.slice(0, 7)
}
