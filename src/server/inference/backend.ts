import { config } from '../config.ts'
import { llamaSwap } from '../llama-swap/client.ts'

export type InferenceBackendKind = 'llama-swap'

export type InferenceBackendInfo = {
  kind: InferenceBackendKind
  label: string
  upstreamBaseUrl: string
  upstreamHost: string
  capabilities: {
    models: boolean
    runningModels: boolean
    lifecycle: boolean
    logs: boolean
    config: boolean
    metrics: boolean
  }
}

export type InferenceHealth = {
  reachable: boolean
  health?: string
  version?: string
  commit?: string
  latencyMs?: number
  error?: string
}

export type InferenceBackend = {
  info: InferenceBackendInfo
  ping(): Promise<{ reachable: boolean; latencyMs?: number }>
  health(): Promise<InferenceHealth>
  defaultProxyUpstream(pathname: string, search: string): string
  eventStreamUrl?: string
  listModels: typeof llamaSwap.listModels
  listRunning?: typeof llamaSwap.listRunning
  loadModel?: typeof llamaSwap.loadModel
  unloadModel?: typeof llamaSwap.unloadModel
  unloadAll?: typeof llamaSwap.unloadAll
}

function getLlamaSwapInfo(): InferenceBackendInfo {
  const upstreamUrl = new URL(config.llamaSwapUrl)
  return {
    kind: 'llama-swap',
    label: 'llama-swap',
    upstreamBaseUrl: config.llamaSwapUrl,
    upstreamHost: upstreamUrl.host,
    capabilities: {
      models: true,
      runningModels: true,
      lifecycle: true,
      logs: true,
      config: Boolean(config.llamaSwapConfigFile),
      metrics: true,
    },
  }
}

export const inferenceBackend: InferenceBackend = {
  get info() {
    return getLlamaSwapInfo()
  },
  async ping() {
    const t0 = performance.now()
    try {
      await llamaSwap.health()
      return { reachable: true, latencyMs: Math.round(performance.now() - t0) }
    } catch {
      return { reachable: false }
    }
  },
  async health() {
    try {
      const t0 = performance.now()
      const [health, version] = await Promise.all([llamaSwap.health(), llamaSwap.version()])
      const latencyMs = Math.round(performance.now() - t0)
      return { reachable: true, health: health.trim(), latencyMs, ...version }
    } catch (err) {
      return {
        reachable: false,
        error: err instanceof Error ? err.message : String(err),
      }
    }
  },
  defaultProxyUpstream(pathname, search) {
    return `${config.llamaSwapUrl}${pathname}${search}`
  },
  eventStreamUrl: `${config.llamaSwapUrl}/api/events`,
  listModels: llamaSwap.listModels,
  listRunning: llamaSwap.listRunning,
  loadModel: llamaSwap.loadModel,
  unloadModel: llamaSwap.unloadModel,
  unloadAll: llamaSwap.unloadAll,
}
