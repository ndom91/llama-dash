import * as v from 'valibot'
import type { BaseIssue, BaseSchema, InferOutput } from 'valibot'
import { ApiKeyCreatedSchema, ApiKeyListResponseSchema, KeyDetailResponseSchema } from './schemas/api-key'
import { ModelAliasListResponseSchema, ModelAliasSchema } from './schemas/model-alias'
import { RoutingRuleListResponseSchema, RoutingRuleSchema } from './schemas/routing-rule'
import { AttributionSettingsSchema, RequestLimitsSchema } from './schemas/settings'
import { ApiSystemStatusSchema } from './schemas/system'
import { ApiConfigReadSchema, ApiConfigSaveResultSchema, ApiConfigValidationSchema } from './schemas/config'
import { GpuSnapshotSchema } from './schemas/gpu'
import { ApiHealthSchema } from './schemas/health'
import { ModelDetailResponseSchema, ModelsResponseSchema, ModelTimelineResponseSchema } from './schemas/model'
import {
  HistogramResponseSchema,
  ApiRequestStatsSchema,
  RequestDetailResponseSchema,
  RequestsListResponseSchema,
} from './schemas/request'

export type {
  ApiModel,
  ApiModelDetail,
  ApiModelEvent,
  ApiModelKeyBreakdown,
  ApiModelStats,
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
export type { ApiKeyItem, ApiKeyCreated, ApiKeyDetail, ApiKeyStats, ApiKeyModelBreakdown } from './schemas/api-key'
export type { ModelAliasItem } from './schemas/model-alias'
export type { RoutingRule, RoutingMatch, RoutingAction } from './schemas/routing-rule'
export type { AttributionSettings, RequestLimits } from './schemas/settings'
export type { ApiSystemStatus } from './schemas/system'

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

function getJson<T extends AnySchema>(url: string, schema: T): Promise<InferOutput<T>> {
  return fetch(url).then(validated(schema))
}

function sendJson<T extends AnySchema>(
  url: string,
  schema: T,
  options: { method: string; body?: unknown },
): Promise<InferOutput<T>> {
  return fetch(url, {
    method: options.method,
    headers: { 'content-type': 'application/json' },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  }).then(validated(schema))
}

function sendEmpty<T extends AnySchema>(url: string, schema: T, method: string): Promise<InferOutput<T>> {
  return fetch(url, { method }).then(validated(schema))
}

export const api = {
  listModels: () => getJson('/api/models', ModelsResponseSchema),
  getModelDetail: (id: string) => getJson(`/api/models/${encodeURIComponent(id)}`, ModelDetailResponseSchema),
  listRequests: (params: { limit?: number; cursor?: string } = {}) => {
    const q = new URLSearchParams()
    if (params.limit != null) q.set('limit', String(params.limit))
    if (params.cursor != null) q.set('cursor', params.cursor)
    const suffix = q.toString() ? `?${q.toString()}` : ''
    return getJson(`/api/requests${suffix}`, RequestsListResponseSchema)
  },
  getRequest: (id: string) => getJson(`/api/requests/${id}`, RequestDetailResponseSchema),
  loadModel: (id: string) => sendEmpty(`/api/models/${encodeURIComponent(id)}/load`, OkSchema, 'POST'),
  unloadModel: (id: string) => sendEmpty(`/api/models/${encodeURIComponent(id)}/unload`, OkSchema, 'POST'),
  unloadAll: () => sendEmpty('/api/models/unload', OkSchema, 'POST'),
  getConfig: () => getJson('/api/config', ApiConfigReadSchema),
  saveConfig: (content: string, modifiedAt: number) =>
    sendJson('/api/config', ApiConfigSaveResultSchema, { method: 'PUT', body: { content, modifiedAt } }),
  validateConfig: (content: string) =>
    sendJson('/api/config/validate', ApiConfigValidationSchema, { method: 'POST', body: { content } }),
  health: () => getJson('/api/health', ApiHealthSchema),
  systemStatus: () => getJson('/api/system', ApiSystemStatusSchema),
  requestStats: () => getJson('/api/requests/stats', ApiRequestStatsSchema),
  modelTimeline: (windowMs?: number) => {
    const q = windowMs != null ? `?window=${windowMs}` : ''
    return getJson(`/api/model-timeline${q}`, ModelTimelineResponseSchema)
  },
  gpu: () => getJson('/api/gpu', GpuSnapshotSchema),
  requestHistogram: (params: { window?: number; bucket?: number } = {}) => {
    const q = new URLSearchParams()
    if (params.window != null) q.set('window', String(params.window))
    if (params.bucket != null) q.set('bucket', String(params.bucket))
    const suffix = q.toString() ? `?${q.toString()}` : ''
    return getJson(`/api/requests/histogram${suffix}`, HistogramResponseSchema)
  },
  getKeyDetail: (id: string) => getJson(`/api/keys/${id}`, KeyDetailResponseSchema),
  listKeys: () => getJson('/api/keys', ApiKeyListResponseSchema),
  createKey: (body: {
    name: string
    allowedModels?: Array<string>
    rateLimitRpm?: number | null
    rateLimitTpm?: number | null
    monthlyTokenQuota?: number | null
  }) => sendJson('/api/keys', ApiKeyCreatedSchema, { method: 'POST', body }),
  renameKey: (id: string, name: string) => sendJson(`/api/keys/${id}`, OkSchema, { method: 'PATCH', body: { name } }),
  updateKeyModels: (id: string, allowedModels: Array<string>) =>
    sendJson(`/api/keys/${id}`, OkSchema, { method: 'PATCH', body: { allowedModels } }),
  updateKeySystemPrompt: (id: string, systemPrompt: string | null) =>
    sendJson(`/api/keys/${id}`, OkSchema, { method: 'PATCH', body: { systemPrompt } }),
  revokeKey: (id: string) => sendEmpty(`/api/keys/${id}/revoke`, OkSchema, 'POST'),
  deleteKey: (id: string) => sendEmpty(`/api/keys/${id}`, OkSchema, 'DELETE'),
  listAliases: () => getJson('/api/aliases', ModelAliasListResponseSchema),
  createAlias: (body: { alias: string; model: string }) =>
    sendJson('/api/aliases', ModelAliasSchema, { method: 'POST', body }),
  updateAlias: (id: string, body: { alias?: string; model?: string }) =>
    sendJson(`/api/aliases/${id}`, ModelAliasSchema, { method: 'PATCH', body }),
  deleteAlias: (id: string) => sendEmpty(`/api/aliases/${id}`, OkSchema, 'DELETE'),
  listRoutingRules: () => getJson('/api/routing-rules', RoutingRuleListResponseSchema),
  createRoutingRule: (body: {
    name: string
    enabled: boolean
    match: object
    action: object
    target?: object
    authMode?: string
    preserveAuthorization?: boolean
  }) => sendJson('/api/routing-rules', RoutingRuleSchema, { method: 'POST', body }),
  updateRoutingRule: (
    id: string,
    body: {
      name?: string
      enabled?: boolean
      match?: object
      action?: object
      target?: object
      authMode?: string
      preserveAuthorization?: boolean
    },
  ) => sendJson(`/api/routing-rules/${id}`, RoutingRuleSchema, { method: 'PATCH', body }),
  deleteRoutingRule: (id: string) => sendEmpty(`/api/routing-rules/${id}`, OkSchema, 'DELETE'),
  reorderRoutingRules: (ids: string[]) =>
    sendJson('/api/routing-rules/reorder', RoutingRuleListResponseSchema, { method: 'POST', body: { ids } }),
  getAttributionSettings: () => getJson('/api/settings/attribution', AttributionSettingsSchema),
  updateAttributionSettings: (body: {
    clientNameHeader?: string | null
    endUserIdHeader?: string | null
    sessionIdHeader?: string | null
  }) => sendJson('/api/settings/attribution', AttributionSettingsSchema, { method: 'PATCH', body }),
  getRequestLimits: () => getJson('/api/settings/request-limits', RequestLimitsSchema),
  updateRequestLimits: (body: { maxMessages?: number | null; maxEstimatedTokens?: number | null }) =>
    sendJson('/api/settings/request-limits', RequestLimitsSchema, { method: 'PATCH', body }),
}
