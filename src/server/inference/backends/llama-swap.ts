import { config } from '../../config.ts'
import { llamaSwap } from '../../llama-swap/client.ts'
import type { OpenAiModel, RunningModel } from '../../llama-swap/client.ts'
import type { PerformanceSysStat } from '../../llama-swap/schemas.ts'
import { watchLlamaSwapPauseState } from '../../llama-swap/pause-watcher.ts'
import { inferencePaused, onInferencePausedChange, setInferencePaused } from '../pause-state.ts'
import type {
  BackendModel,
  BackendModelCapabilities,
  BackendRunningModel,
  HostPerformanceSample,
  InferenceBackend,
  InferenceBackendInfo,
} from '../backend.ts'
import {
  extractCtxSize,
  getLlamaSwapConfigContextLengths,
  getLlamaSwapModelConfigSnippet,
  getLlamaSwapModelLogNames,
  getLlamaSwapPeerHosts,
} from '../llama-swap-config.ts'
import { errorMessage } from '../../error-message.ts'

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

function pickLlamaSwapModelCapabilities(model: OpenAiModel): BackendModelCapabilities {
  const inputModalities = model.architecture?.input_modalities ?? []
  const outputModalities = model.architecture?.output_modalities ?? []
  const flags = Object.entries(model.capabilities ?? {})
    .filter(([, value]) => value === true)
    .map(([key]) => key)
    .sort()

  return {
    inputModalities,
    outputModalities,
    flags,
    supportedParameters: model.supported_parameters ?? [],
  }
}

function mapLlamaSwapModel(model: OpenAiModel): BackendModel {
  const llamaSwapMeta = model.meta?.llamaswap
  const isSelector = llamaSwapMeta?.type === 'selector'
  const peerId = isSelector ? null : (llamaSwapMeta?.peerID ?? null)
  return {
    id: model.id,
    name: model.name ?? model.id,
    kind: isSelector ? 'selector' : peerId ? 'peer' : 'local',
    peerId,
    selector: isSelector
      ? {
          strategy: llamaSwapMeta.strategy ?? 'unknown',
          targets: llamaSwapMeta.targets ?? [],
          spillover: llamaSwapMeta.spillover ?? null,
        }
      : null,
    running: model.status?.value === 'loaded',
    contextLength: pickLlamaSwapModelContextLength(model),
    capabilities: pickLlamaSwapModelCapabilities(model),
  }
}

function mapLlamaSwapRunningModel(model: RunningModel): BackendRunningModel {
  return {
    model: model.model,
    state: model.state,
    ttl: model.ttl,
    contextLength: extractCtxSize(model.cmd),
  }
}

const MIB = 1024 * 1024

function mapLlamaSwapPerformanceSample(stat: PerformanceSysStat): HostPerformanceSample {
  return {
    timestamp: Date.parse(stat.timestamp),
    cpuPerCore: stat.cpu_util_per_core,
    memTotalBytes: stat.mem_total_mb * MIB,
    memUsedBytes: stat.mem_used_mb * MIB,
    swapTotalBytes: stat.swap_total_mb * MIB,
    swapUsedBytes: stat.swap_used_mb * MIB,
    loadAvg: [stat.load_avg_1, stat.load_avg_5, stat.load_avg_15],
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
      pause: true,
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
          error: errorMessage(err),
        }
      }
    },
    defaultProxyUpstream(pathname, search) {
      return `${config.inferenceBaseUrl}${pathname}${search}`
    },
    // llama-swap v259 split log traffic from dashboard events. Request the two
    // streams rendered by llama-dash's Logs page; the upstream sends backlog
    // followed by live SSE logData envelopes.
    eventStreamUrl: `${config.inferenceBaseUrl}/api/events/logs?stream=proxy&stream=upstream`,
    async listModels() {
      const models = await llamaSwap.listModels()
      return models.data.map(mapLlamaSwapModel)
    },
    async listRunning() {
      const { running } = await llamaSwap.listRunning()
      return running.map(mapLlamaSwapRunningModel)
    },
    hardware: () => llamaSwap.hardware(),
    async hostPerformance(afterMs) {
      const res = await llamaSwap.performance(afterMs == null ? undefined : new Date(afterMs).toISOString())
      return (res.sys_stats ?? []).map(mapLlamaSwapPerformanceSample)
    },
    modelLogNames: getLlamaSwapModelLogNames,
    modelConfigSnippet: getLlamaSwapModelConfigSnippet,
    modelContextLengthHints: getLlamaSwapConfigContextLengths,
    peerHostHints: getLlamaSwapPeerHosts,
    async loadModel(id) {
      await llamaSwap.loadModel(id)
    },
    async unloadModel(id) {
      await llamaSwap.unloadModel(id)
    },
    async unloadAll() {
      await llamaSwap.unloadAll()
    },
    async pauseInference() {
      return setInferencePaused((await llamaSwap.pause()).paused)
    },
    async resumeInference() {
      return setInferencePaused((await llamaSwap.resume()).paused)
    },
    inferencePaused,
    async reasoningEffortLevels(id) {
      const props = await llamaSwap.props(id)
      return props.chat_template_caps?.reasoning_effort_levels ?? []
    },
    async modelSpecs(id) {
      const meta = (await llamaSwap.upstreamModels(id)).data[0]?.meta
      if (!meta) return null
      return { sizeBytes: meta.size ?? null, paramCount: meta.n_params ?? null, quantization: meta.ftype ?? null }
    },
    watchPauseState(onChange) {
      onInferencePausedChange(onChange)
      watchLlamaSwapPauseState(setInferencePaused)
    },
  }
}
