import * as v from 'valibot'
import { clearShellContext } from './shell-context-cache'
import { JsonValidatorCache } from './json-validator-cache'
import type { BaseIssue, BaseSchema, InferOutput } from 'valibot'
import { ArticleExtractResponseSchema } from './schemas/article'
import { ApiKeyCreatedSchema, ApiKeyListResponseSchema, KeyDetailResponseSchema } from './schemas/api-key'
import type { ModelAccessMode } from './schemas/api-key'
import { ModelAliasListResponseSchema, ModelAliasSchema } from './schemas/model-alias'
import { McpRelayListResponseSchema, McpRelaySchema } from './schemas/mcp-relay'
import { RoutingRuleListResponseSchema, RoutingRuleSchema } from './schemas/routing-rule'
import { UpstreamCredentialListResponseSchema, UpstreamCredentialSchema } from './schemas/upstream-credential'
import { AttributionSettingsSchema, PrivacySettingsSchema, RequestLimitsSchema } from './schemas/settings'
import { ApiSystemStatusSchema, LoginMetaSchema } from './schemas/system'
import { ApiConfigReadSchema, ApiConfigSaveResultSchema, ApiConfigValidationSchema } from './schemas/config'
import { GpuSnapshotSchema } from './schemas/gpu'
import { ApiHealthSchema } from './schemas/health'
import { ModelDetailResponseSchema, ModelsResponseSchema, ModelTimelineResponseSchema } from './schemas/model'
import {
  HistogramResponseSchema,
  ApiRequestStatsSchema,
  RequestDetailResponseSchema,
  RequestMetadataResponseSchema,
  RequestPayloadsSchema,
  RequestsListResponseSchema,
} from './schemas/request'
import {
  ApiUsageReportSchema,
  ApiUsageSummarySchema,
  type UpdateUsagePanelSettingsBody,
  type UsagePeriodDays,
  UsagePanelSettingsSchema,
} from './schemas/usage'

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
export type {
  ApiKeyItem,
  ApiKeyCreated,
  ApiKeyDetail,
  ApiKeyStats,
  ApiKeyModelBreakdown,
  ModelAccessMode,
} from './schemas/api-key'
export type { ModelAliasItem } from './schemas/model-alias'
export type { McpRelay } from './schemas/mcp-relay'
export type { RoutingRule, RoutingMatch, RoutingAction } from './schemas/routing-rule'
export type { UpstreamCredential } from './schemas/upstream-credential'
export type { AttributionSettings, PrivacySettings, RequestLimits } from './schemas/settings'
export type { ApiSystemStatus, LoginMeta } from './schemas/system'
export type { InferenceHardware } from './schemas/inference-hardware'
export type { ArticleExtractResponse } from './schemas/article'
export type {
  ApiUsageBreakdownRow,
  ApiUsageDay,
  ApiUsagePanel,
  ApiUsageReport,
  ApiUsageSummary,
  ApiUsageTotals,
  ApiUsageWindow,
  UpdateUsagePanelSettingsBody,
  UsageDimension,
  UsagePanelSettings,
  UsagePanels,
  UsagePeriodDays,
} from './schemas/usage'

type AnySchema = BaseSchema<unknown, unknown, BaseIssue<unknown>>
export type ApiFetchOptions = Pick<RequestInit, 'signal' | 'priority'>

const jsonCache = new JsonValidatorCache()

async function readJsonResponse<T extends AnySchema>(res: Response, schema: T) {
  if (!res.ok) {
    if (res.status === 401) {
      clearShellContext()
      jsonCache.clear()
    }
    const body = await res.text().catch(() => '')
    throw new Error(`${res.status} ${res.statusText}: ${body.slice(0, 200)}`)
  }
  const text = await res.text()
  return { data: v.parse(schema, JSON.parse(text)), bytes: text.length * 2 }
}

const OkSchema = v.object({ ok: v.literal(true) })

async function getJson<T extends AnySchema>(
  url: string,
  schema: T,
  options: ApiFetchOptions = {},
): Promise<InferOutput<T>> {
  const cached = jsonCache.get(url, schema)
  const res = await fetch(url, { ...options, headers: cached?.etag ? { 'if-none-match': cached.etag } : undefined })
  if (res.status === 304 && cached) return cached.data
  if (!res.ok) jsonCache.delete(url)
  const { data, bytes } = await readJsonResponse(res, schema)
  const etag = res.headers.get('etag')
  if (etag && !res.headers.get('cache-control')?.includes('no-store')) jsonCache.set(url, schema, data, etag, bytes)
  else jsonCache.delete(url)
  return data
}

async function sendJson<T extends AnySchema>(
  url: string,
  schema: T,
  options: { method: string; body?: unknown },
): Promise<InferOutput<T>> {
  const response = await fetch(url, {
    method: options.method,
    headers: { 'content-type': 'application/json' },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  })
  const { data } = await readJsonResponse(response, schema)
  jsonCache.clear()
  return data
}

async function sendEmpty<T extends AnySchema>(url: string, schema: T, method: string): Promise<InferOutput<T>> {
  const { data } = await readJsonResponse(await fetch(url, { method }), schema)
  jsonCache.clear()
  return data
}

export const api = {
  listModels: () => getJson('/api/models', ModelsResponseSchema),
  getModelDetail: (id: string) => getJson(`/api/models/${encodeURIComponent(id)}`, ModelDetailResponseSchema),
  listRequests: (
    params: { limit?: number; cursor?: string; includeMcp?: boolean } = {},
    options: ApiFetchOptions = {},
  ) => {
    const q = new URLSearchParams()
    if (params.limit != null) q.set('limit', String(params.limit))
    if (params.cursor != null) q.set('cursor', params.cursor)
    if (params.includeMcp) q.set('includeMcp', 'true')
    const suffix = q.toString() ? `?${q.toString()}` : ''
    return getJson(`/api/requests${suffix}`, RequestsListResponseSchema, { priority: 'high', ...options })
  },
  getRequest: (id: string) => getJson(`/api/requests/${id}`, RequestDetailResponseSchema),
  getRequestMetadata: (id: string, options: ApiFetchOptions = {}) =>
    getJson(`/api/requests/${id}/metadata`, RequestMetadataResponseSchema, { priority: 'high', ...options }),
  getRequestPayloads: (id: string, options: ApiFetchOptions = {}) =>
    getJson(`/api/requests/${id}/payloads`, RequestPayloadsSchema, { priority: 'high', ...options }),
  loadModel: (id: string) => sendEmpty(`/api/models/${encodeURIComponent(id)}/load`, OkSchema, 'POST'),
  unloadModel: (id: string) => sendEmpty(`/api/models/${encodeURIComponent(id)}/unload`, OkSchema, 'POST'),
  unloadAll: () => sendEmpty('/api/models/unload', OkSchema, 'POST'),
  getConfig: () => getJson('/api/config', ApiConfigReadSchema),
  saveConfig: (content: string, modifiedAt: number) =>
    sendJson('/api/config', ApiConfigSaveResultSchema, { method: 'PUT', body: { content, modifiedAt } }),
  validateConfig: (content: string) =>
    sendJson('/api/config/validate', ApiConfigValidationSchema, { method: 'POST', body: { content } }),
  health: (options: ApiFetchOptions = {}) => getJson('/api/health', ApiHealthSchema, { priority: 'low', ...options }),
  loginMeta: () => getJson('/api/login-meta', LoginMetaSchema),
  systemStatus: (options: ApiFetchOptions = {}) =>
    getJson('/api/system', ApiSystemStatusSchema, { priority: 'low', ...options }),
  requestStats: (options: ApiFetchOptions = {}) =>
    getJson('/api/requests/stats', ApiRequestStatsSchema, { priority: 'low', ...options }),
  modelTimeline: (windowMs?: number, options: ApiFetchOptions = {}) => {
    const q = windowMs != null ? `?window=${windowMs}` : ''
    return getJson(`/api/model-timeline${q}`, ModelTimelineResponseSchema, { priority: 'low', ...options })
  },
  gpu: (options: ApiFetchOptions = {}) => getJson('/api/gpu', GpuSnapshotSchema, { priority: 'low', ...options }),
  usage: (days: UsagePeriodDays) => getJson(`/api/usage?days=${days}`, ApiUsageReportSchema),
  usageSummary: () => getJson('/api/usage/summary', ApiUsageSummarySchema),
  getUsagePanelSettings: () => getJson('/api/settings/usage', UsagePanelSettingsSchema),
  updateUsagePanelSettings: (body: UpdateUsagePanelSettingsBody) =>
    sendJson('/api/settings/usage', UsagePanelSettingsSchema, { method: 'PATCH', body }),
  requestHistogram: (params: { window?: number; bucket?: number } = {}, options: ApiFetchOptions = {}) => {
    const q = new URLSearchParams()
    if (params.window != null) q.set('window', String(params.window))
    if (params.bucket != null) q.set('bucket', String(params.bucket))
    const suffix = q.toString() ? `?${q.toString()}` : ''
    return getJson(`/api/requests/histogram${suffix}`, HistogramResponseSchema, { priority: 'low', ...options })
  },
  getKeyDetail: (id: string) => getJson(`/api/keys/${id}`, KeyDetailResponseSchema),
  listKeys: () => getJson('/api/keys', ApiKeyListResponseSchema),
  createKey: (body: {
    name: string
    modelAccessMode?: ModelAccessMode
    allowedModels?: Array<string>
    allowedMcpRelays?: Array<string>
    rateLimitRpm?: number | null
    rateLimitTpm?: number | null
    monthlyTokenQuota?: number | null
    systemPrompt?: string | null
    expiresAt?: string | null
  }) => sendJson('/api/keys', ApiKeyCreatedSchema, { method: 'POST', body }),
  renameKey: (id: string, name: string) => sendJson(`/api/keys/${id}`, OkSchema, { method: 'PATCH', body: { name } }),
  updateKeyModels: (id: string, modelAccessMode: ModelAccessMode, allowedModels: Array<string>) =>
    sendJson(`/api/keys/${id}`, OkSchema, { method: 'PATCH', body: { modelAccessMode, allowedModels } }),
  updateKeyMcpRelays: (id: string, allowedMcpRelays: Array<string>) =>
    sendJson(`/api/keys/${id}`, OkSchema, { method: 'PATCH', body: { allowedMcpRelays } }),
  updateKeySystemPrompt: (id: string, systemPrompt: string | null) =>
    sendJson(`/api/keys/${id}`, OkSchema, { method: 'PATCH', body: { systemPrompt } }),
  rotateKey: (id: string) => sendEmpty(`/api/keys/${id}/rotate`, ApiKeyCreatedSchema, 'POST'),
  revokeKey: (id: string) => sendEmpty(`/api/keys/${id}/revoke`, OkSchema, 'POST'),
  deleteKey: (id: string) => sendEmpty(`/api/keys/${id}`, OkSchema, 'DELETE'),
  listAliases: () => getJson('/api/aliases', ModelAliasListResponseSchema),
  createAlias: (body: { alias: string; model: string }) =>
    sendJson('/api/aliases', ModelAliasSchema, { method: 'POST', body }),
  updateAlias: (id: string, body: { alias?: string; model?: string }) =>
    sendJson(`/api/aliases/${id}`, ModelAliasSchema, { method: 'PATCH', body }),
  deleteAlias: (id: string) => sendEmpty(`/api/aliases/${id}`, OkSchema, 'DELETE'),
  listRoutingRules: () => getJson('/api/routing-rules', RoutingRuleListResponseSchema),
  listUpstreamCredentials: () => getJson('/api/upstream-credentials', UpstreamCredentialListResponseSchema),
  listMcpRelays: () => getJson('/api/mcp-relays', McpRelayListResponseSchema),
  createMcpRelay: (body: {
    name: string
    slug?: string
    targetUrl: string
    credentialId: string
    headerName?: string
    headerValueTemplate?: string
  }) => sendJson('/api/mcp-relays', McpRelaySchema, { method: 'POST', body }),
  deleteMcpRelay: (id: string) => sendEmpty(`/api/mcp-relays/${id}`, OkSchema, 'DELETE'),
  createUpstreamCredential: (body: { name: string; slug?: string; type: 'bearer'; value: string }) =>
    sendJson('/api/upstream-credentials', UpstreamCredentialSchema, { method: 'POST', body }),
  updateUpstreamCredential: (id: string, body: { name?: string; slug?: string; value?: string }) =>
    sendJson(`/api/upstream-credentials/${id}`, UpstreamCredentialSchema, { method: 'PATCH', body }),
  deleteUpstreamCredential: (id: string) => sendEmpty(`/api/upstream-credentials/${id}`, OkSchema, 'DELETE'),
  createRoutingRule: (body: {
    name: string
    enabled: boolean
    match: object
    action: object
    target?: object
    authMode?: string
    preserveAuthorization?: boolean
    credentialBindings?: object[]
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
      credentialBindings?: object[]
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
  getPrivacySettings: () => getJson('/api/settings/privacy', PrivacySettingsSchema),
  updatePrivacySettings: (body: {
    captureRequestBodies?: boolean
    captureResponseBodies?: boolean
    maxStoredBodyBytes?: number
    mcpRelayPersistSuccessBodies?: boolean
    requestLogRetentionDays?: number
    mcpRelaySuccessRetentionDays?: number
    mcpRelayErrorRetentionDays?: number
    bodyRetentionDays?: number
  }) => sendJson('/api/settings/privacy', PrivacySettingsSchema, { method: 'PATCH', body }),
  pruneRequestLogs: () => sendJson('/api/system/request-logs/prune', v.any(), { method: 'POST', body: {} }),
  compactDatabase: () => sendJson('/api/system/database/compact', OkSchema, { method: 'POST', body: {} }),
  extractArticle: (url: string) =>
    sendJson('/api/playground/article-extract', ArticleExtractResponseSchema, { method: 'POST', body: { url } }),
}
