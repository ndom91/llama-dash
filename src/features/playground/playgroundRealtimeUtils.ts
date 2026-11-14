import type { ApiModel } from '../../lib/schemas/model'

type CapabilityModel = Pick<ApiModel, 'capabilities'>

/** True when llama-swap reports audio in both input and output modalities. */
export function isRealtimeAudioModel(model: CapabilityModel): boolean {
  return model.capabilities.inputModalities.includes('audio') && model.capabilities.outputModalities.includes('audio')
}

/**
 * Local models split into audio-capable ones and the rest. Capability metadata
 * can lag behind what llama-server actually supports, so the rest stay
 * selectable.
 */
export function splitRealtimeModels<T extends CapabilityModel & Pick<ApiModel, 'kind'>>(models: ReadonlyArray<T>) {
  const local = models.filter((model) => model.kind === 'local')
  return {
    audio: local.filter(isRealtimeAudioModel),
    other: local.filter((model) => !isRealtimeAudioModel(model)),
  }
}

export function formatRealtimeMs(ms: number | null): string {
  if (ms == null) return '—'
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)} s` : `${Math.round(ms)} ms`
}

export function formatRealtimeClock(at: number): string {
  const date = new Date(at)
  const hh = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  const ss = String(date.getSeconds()).padStart(2, '0')
  const ms = String(date.getMilliseconds()).padStart(3, '0')
  return `${hh}:${mm}:${ss}.${ms}`
}
