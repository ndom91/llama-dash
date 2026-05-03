import { config } from '../../config.ts'
import { llamaSwap } from '../../llama-swap/client.ts'
import type { OpenAiModel, RunningModel } from '../../llama-swap/client.ts'
import type { BackendModel, BackendRunningModel, InferenceBackend, InferenceBackendInfo } from '../backend.ts'
import {
  getLlamaSwapConfigContextLengths,
  getLlamaSwapModelConfigSnippet,
  getLlamaSwapModelLogNames,
} from '../llama-swap-config.ts'

function pickLlamaSwapModelContextLength(model: OpenAiModel): number | null {
  return (
    model.context_length ??
    model.contextLength ??
    model.n_ctx ??
    model.meta?.context_length ??
    model.meta?.contextLength ??
    model.meta?.n_ctx ??
    model.meta?.llamaswap?.context_length ??
    model.meta?.llamaswap?.contextLength ??
    model.meta?.llamaswap?.n_ctx ??
    null
  )
}

function extractCtxSize(value: unknown): number | null {
  if (typeof value !== 'string') return null
  const match = value.match(/--ctx-size(?:\s+|=)(\d+)/)
  return match ? Number(match[1]) : null
}

function mapLlamaSwapModel(model: OpenAiModel): BackendModel {
  const peerId = model.meta?.llamaswap?.peerID ?? null
  return {
    id: model.id,
    name: model.name ?? model.id,
    kind: peerId ? 'peer' : 'local',
    peerId,
    contextLength: pickLlamaSwapModelContextLength(model),
  }
}

function mapLlamaSwapRunningModel(model: RunningModel): BackendRunningModel {
  return {
    model: model.model,
    state: model.state,
    ttl: model.ttl ?? null,
    contextLength: extractCtxSize(model.cmd),
  }
}

function getLlamaSwapInfo(): InferenceBackendInfo {
  const upstreamUrl = new URL(config.inferenceBaseUrl)
  return {
    kind: 'llama-swap',
    label: 'llama-swap',
    upstreamBaseUrl: config.inferenceBaseUrl,
    upstreamHost: upstreamUrl.host,
    capabilities: {
      models: true,
      runningModels: true,
      lifecycle: true,
      logs: true,
      config: true,
      metrics: true,
    },
  }
}

export function createLlamaSwapBackend(): InferenceBackend {
  return {
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
      return `${config.inferenceBaseUrl}${pathname}${search}`
    },
    eventStreamUrl: `${config.inferenceBaseUrl}/api/events`,
    async listModels() {
      const models = await llamaSwap.listModels()
      return models.data.map(mapLlamaSwapModel)
    },
    async listRunning() {
      const { running } = await llamaSwap.listRunning()
      return running.map(mapLlamaSwapRunningModel)
    },
    modelLogNames: getLlamaSwapModelLogNames,
    modelConfigSnippet: getLlamaSwapModelConfigSnippet,
    modelContextLengthHints: getLlamaSwapConfigContextLengths,
    async loadModel(id) {
      await llamaSwap.loadModel(id)
    },
    async unloadModel(id) {
      await llamaSwap.unloadModel(id)
    },
    async unloadAll() {
      await llamaSwap.unloadAll()
    },
  }
}
