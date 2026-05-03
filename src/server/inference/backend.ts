import { config } from '../config.ts'
import { createLlamaSwapBackend } from './backends/llama-swap.ts'

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
  loadModel?(id: string): Promise<void>
  unloadModel?(id: string): Promise<void>
  unloadAll?(): Promise<void>
}

function createInferenceBackend(kind: string): InferenceBackend {
  if (kind === 'llama-swap') return createLlamaSwapBackend()
  throw new Error(`Unsupported INFERENCE_BACKEND "${kind}". Supported backends: llama-swap`)
}

export const inferenceBackend = createInferenceBackend(config.inferenceBackend)
