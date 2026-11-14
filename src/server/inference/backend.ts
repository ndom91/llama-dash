import { config } from '../config.ts'
import type { InferenceHardware } from '../../lib/schemas/inference-hardware.ts'
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
    pause: boolean
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
  kind: 'local' | 'peer' | 'selector'
  peerId: string | null
  selector: BackendModelSelector | null
  running: boolean
  contextLength: number | null
  capabilities: BackendModelCapabilities
}

export type BackendModelSelector = {
  strategy: string
  targets: Array<string>
  spillover: number | null
}

export type BackendModelCapabilities = {
  inputModalities: Array<string>
  outputModalities: Array<string>
  flags: Array<string>
  supportedParameters: Array<string>
}

export type BackendRunningModel = {
  model: string
  state: string
  ttl: number | null
  contextLength: number | null
}

/** One inference-host resource sample. Memory values are bytes. */
export type HostPerformanceSample = {
  timestamp: number
  cpuPerCore: Array<number>
  memTotalBytes: number
  memUsedBytes: number
  swapTotalBytes: number
  swapUsedBytes: number
  loadAvg: [number, number, number]
}

export type InferenceBackend = {
  info: InferenceBackendInfo
  ping(): Promise<{ reachable: boolean; latencyMs?: number }>
  health(): Promise<InferenceHealth>
  defaultProxyUpstream(pathname: string, search: string): string
  eventStreamUrl?: string
  listModels(): Promise<Array<BackendModel>>
  listRunning?(): Promise<Array<BackendRunningModel>>
  hardware?(): Promise<InferenceHardware>
  /** Host resource samples newer than `afterMs`, oldest first. */
  hostPerformance?(afterMs?: number): Promise<Array<HostPerformanceSample>>
  modelLogNames?(modelId: string): Array<string>
  modelConfigSnippet?(modelId: string): string | null
  modelContextLengthHints?(): Map<string, number>
  /** Peer id → host of the peer's proxy URL. */
  peerHostHints?(): Map<string, string>
  loadModel?(id: string): Promise<void>
  unloadModel?(id: string): Promise<void>
  unloadAll?(): Promise<void>
  /** Unloads every model and rejects inference until resumed. Returns the new paused state. */
  pauseInference?(): Promise<boolean>
  resumeInference?(): Promise<boolean>
  /** Last known paused state, or null when unknown. */
  inferencePaused?(): boolean | null
  /**
   * Reasoning effort levels the model's chat template accepts. Callers must only
   * ask for running models, because the lookup may otherwise start the model.
   */
  reasoningEffortLevels?(id: string): Promise<Array<string>>
  /** Starts following pause changes, including ones made outside llama-dash. */
  watchPauseState?(onChange: (paused: boolean | null) => void): void
}

function createInferenceBackend(kind: string): InferenceBackend {
  if (kind === 'llama-swap') return createLlamaSwapBackend()
  throw new Error(`Unsupported INFERENCE_BACKEND "${kind}". Supported backends: llama-swap`)
}

export const inferenceBackend = createInferenceBackend(config.inferenceBackend)
