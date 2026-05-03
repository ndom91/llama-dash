import { config } from '../config.ts'
import { llamaSwap } from '../llama-swap/client.ts'
import type { OpenAiModel, RunningModel } from '../llama-swap/client.ts'
import {
  getLlamaSwapConfigContextLengths,
  getLlamaSwapModelConfigSnippet,
  getLlamaSwapModelLogNames,
} from './llama-swap-config.ts'

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

export type BackendModel = {
  id: string
  name: string
  kind: 'local' | 'peer'
  peerId: string | null
  contextLength: number | null
}

export type BackendRunningModel = {
  model: string
  state: string
  ttl: number | null
  contextLength: number | null
}

export type InferenceBackend = {
  info: InferenceBackendInfo
  ping(): Promise<{ reachable: boolean; latencyMs?: number }>
  health(): Promise<InferenceHealth>
  defaultProxyUpstream(pathname: string, search: string): string
  eventStreamUrl?: string
  listModels(): Promise<Array<BackendModel>>
  listRunning?(): Promise<Array<BackendRunningModel>>
  modelLogNames?(modelId: string): Array<string>
  modelConfigSnippet?(modelId: string): string | null
  modelContextLengthHints?(): Map<string, number>
  loadModel?: typeof llamaSwap.loadModel
  unloadModel?: typeof llamaSwap.unloadModel
  unloadAll?: typeof llamaSwap.unloadAll
}

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
  loadModel: llamaSwap.loadModel,
  unloadModel: llamaSwap.unloadModel,
  unloadAll: llamaSwap.unloadAll,
}
