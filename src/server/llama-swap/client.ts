import { config } from '../config.ts'

export type OpenAiModel = {
  id: string
  object: 'model'
  created: number
  owned_by: string
  name?: string
  meta?: {
    llamaswap?: {
      peerID?: string
    }
  }
}

export type RunningModel = {
  model: string
  name: string
  description: string
  state: string
  proxy: string
  ttl: number
  cmd: string
}

type ModelsListResponse = { data: Array<OpenAiModel>; object: 'list' }
type RunningResponse = { running: Array<RunningModel> }

const call = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const res = await fetch(`${config.llamaSwapUrl}${path}`, init)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`llama-swap ${path} -> ${res.status}: ${body.slice(0, 200)}`)
  }
  const ct = res.headers.get('content-type') ?? ''
  if (ct.includes('application/json')) return (await res.json()) as T
  return (await res.text()) as unknown as T
}

export const llamaSwap = {
  listModels: () => call<ModelsListResponse>('/v1/models'),
  listRunning: () => call<RunningResponse>('/running'),
  /** Unload a specific model by id. */
  unloadModel: (id: string) =>
    call<string>(`/api/models/unload/${encodeURIComponent(id)}`, { method: 'POST' }),
  /** Unload every running model. */
  unloadAll: () => call<{ msg: string }>('/api/models/unload', { method: 'POST' }),
  health: () => call<string>('/health'),
  version: () =>
    call<{ version: string; commit: string; build_date: string }>('/api/version'),
}
