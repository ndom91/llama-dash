import * as v from 'valibot'
import type { BaseIssue, BaseSchema, InferOutput } from 'valibot'
import { ApiConfigSaveResultSchema } from './schemas/config'
import { GpuSnapshotSchema } from './schemas/gpu'
import { ApiHealthSchema } from './schemas/health'
import { ModelsResponseSchema, ModelTimelineResponseSchema } from './schemas/model'
import {
  HistogramResponseSchema,
  ApiRequestStatsSchema,
  RequestDetailResponseSchema,
  RequestsListResponseSchema,
} from './schemas/request'

export type {
  ApiModel,
  ApiModelEvent,
} from './schemas/model'
export type {
  ApiRequest,
  ApiRequestDetail,
  ApiRequestStats,
  ApiHistogramBucket,
} from './schemas/request'
export type {
  ApiGpuInfo,
  ApiGpuSnapshot,
} from './schemas/gpu'
export type { ApiHealth } from './schemas/health'
export type {
  ApiConfigRead,
  ApiConfigValidation,
  ApiConfigSaveResult,
} from './schemas/config'

type AnySchema = BaseSchema<unknown, unknown, BaseIssue<unknown>>

const validated =
  <T extends AnySchema>(schema: T) =>
  async (res: Response): Promise<InferOutput<T>> => {
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`${res.status} ${res.statusText}: ${body.slice(0, 200)}`)
    }
    return v.parse(schema, await res.json())
  }

const OkSchema = v.object({ ok: v.literal(true) })
const ConfigReadSchema = v.object({ content: v.string(), modifiedAt: v.number() })
const ConfigValidationSchema = v.union([
  v.object({ valid: v.literal(true) }),
  v.object({ valid: v.literal(false), errors: v.array(v.string()) }),
])

export const api = {
  listModels: () => fetch('/api/models').then(validated(ModelsResponseSchema)),
  listRequests: (params: { limit?: number; cursor?: string } = {}) => {
    const q = new URLSearchParams()
    if (params.limit != null) q.set('limit', String(params.limit))
    if (params.cursor != null) q.set('cursor', params.cursor)
    const suffix = q.toString() ? `?${q.toString()}` : ''
    return fetch(`/api/requests${suffix}`).then(validated(RequestsListResponseSchema))
  },
  getRequest: (id: string) => fetch(`/api/requests/${id}`).then(validated(RequestDetailResponseSchema)),
  loadModel: (id: string) =>
    fetch(`/api/models/${encodeURIComponent(id)}/load`, { method: 'POST' }).then(validated(OkSchema)),
  unloadModel: (id: string) =>
    fetch(`/api/models/${encodeURIComponent(id)}/unload`, { method: 'POST' }).then(validated(OkSchema)),
  unloadAll: () => fetch('/api/models/unload', { method: 'POST' }).then(validated(OkSchema)),
  getConfig: () => fetch('/api/config').then(validated(ConfigReadSchema)),
  saveConfig: (content: string, modifiedAt: number) =>
    fetch('/api/config', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content, modifiedAt }),
    }).then(validated(ApiConfigSaveResultSchema)),
  validateConfig: (content: string) =>
    fetch('/api/config/validate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content }),
    }).then(validated(ConfigValidationSchema)),
  health: () => fetch('/api/health').then(validated(ApiHealthSchema)),
  requestStats: () => fetch('/api/requests/stats').then(validated(ApiRequestStatsSchema)),
  modelTimeline: (windowMs?: number) => {
    const q = windowMs != null ? `?window=${windowMs}` : ''
    return fetch(`/api/model-timeline${q}`).then(validated(ModelTimelineResponseSchema))
  },
  gpu: () => fetch('/api/gpu').then(validated(GpuSnapshotSchema)),
  requestHistogram: (params: { window?: number; bucket?: number } = {}) => {
    const q = new URLSearchParams()
    if (params.window != null) q.set('window', String(params.window))
    if (params.bucket != null) q.set('bucket', String(params.bucket))
    const suffix = q.toString() ? `?${q.toString()}` : ''
    return fetch(`/api/requests/histogram${suffix}`).then(validated(HistogramResponseSchema))
  },
}
