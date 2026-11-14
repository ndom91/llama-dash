import * as v from 'valibot'
import { InferenceHardwareSchema } from '../../lib/schemas/inference-hardware.ts'
import { config } from '../config.ts'
import {
  ModelsListResponseSchema,
  type OpenAiModel,
  PerformanceResponseSchema,
  type RunningModel,
  RunningResponseSchema,
  VersionResponseSchema,
} from './schemas.ts'

export type { OpenAiModel, RunningModel }

const POLL_TIMEOUT_MS = 5_000

const PauseStateSchema = v.object({ paused: v.boolean() })

const callRaw = async (path: string, init?: RequestInit): Promise<Response> => {
  const res = await fetch(`${config.inferenceBaseUrl}${path}`, init)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`llama-swap ${path} -> ${res.status}: ${body.slice(0, 200)}`)
  }
  return res
}

const callText = async (path: string, init?: RequestInit): Promise<string> => (await callRaw(path, init)).text()

const callJson = async <T>(
  path: string,
  schema: v.BaseSchema<unknown, T, v.BaseIssue<unknown>>,
  init?: RequestInit,
): Promise<T> => v.parse(schema, await (await callRaw(path, init)).json())

export const llamaSwap = {
  listModels: () => callJson('/v1/models', ModelsListResponseSchema),
  listRunning: () => callJson('/running', RunningResponseSchema, { signal: AbortSignal.timeout(POLL_TIMEOUT_MS) }),
  unloadModel: (id: string) => callText(`/api/models/unload/${encodeURIComponent(id)}`, { method: 'POST' }),
  loadModel: (id: string) => callText(`/upstream/${encodeURIComponent(id)}/`),
  unloadAll: () => callJson('/api/models/unload', v.object({ msg: v.string() }), { method: 'POST' }),
  pause: () => callJson('/api/models/pause', PauseStateSchema, { method: 'POST' }),
  resume: () => callJson('/api/models/resume', PauseStateSchema, { method: 'POST' }),
  health: () => callText('/health'),
  version: () => callJson('/api/version', VersionResponseSchema),
  hardware: () => callJson('/api/hardware', InferenceHardwareSchema),
  performance: (after?: string) =>
    callJson(`/api/performance${after ? `?after=${encodeURIComponent(after)}` : ''}`, PerformanceResponseSchema, {
      signal: AbortSignal.timeout(POLL_TIMEOUT_MS),
    }),
}
