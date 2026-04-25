import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type UseInfiniteQueryResult,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  api,
  type ApiGpuSnapshot,
  type ApiHealth,
  type ApiHistogramBucket,
  type ApiKeyCreated,
  type ApiKeyDetail,
  type ApiKeyItem,
  type ApiModel,
  type ApiModelDetail,
  type ApiModelEvent,
  type ApiRequest,
  type ApiRequestDetail,
  type ApiRequestStats,
  type ApiSystemStatus,
  type AttributionSettings,
  type ModelAliasItem,
  type PrivacySettings,
  type RoutingRule,
  type RequestLimits,
} from './api'
import type { CreateApiKeyBody } from './schemas/api-key'
import type { CreateModelAliasBody, UpdateModelAliasBody } from './schemas/model-alias'
import type { CreateRoutingRuleBody, UpdateRoutingRuleBody } from './schemas/routing-rule'
import type {
  UpdateAttributionSettingsBody,
  UpdatePrivacySettingsBody,
  UpdateRequestLimitsBody,
} from './schemas/settings'

export const POLL_MS = 5_000

function invalidateKeys(qc: ReturnType<typeof useQueryClient>, keys: ReadonlyArray<readonly unknown[]>) {
  for (const queryKey of keys) qc.invalidateQueries({ queryKey })
}

function toastMutationError(title: string, error: Error) {
  toast.error(title, { description: error.message })
}

export const qk = {
  health: ['health'] as const,
  systemStatus: ['system'] as const,
  models: ['models'] as const,
  requests: ['requests'] as const,
  requestsList: ['requests', 'list'] as const,
  requestsRecent: (limit: number) => ['requests', 'recent', limit] as const,
  requestStats: ['requests', 'stats'] as const,
  requestHistogram: ['requests', 'histogram'] as const,
  gpu: ['gpu'] as const,
  modelTimeline: ['model-timeline'] as const,
  request: (id: string) => ['requests', id] as const,
  modelDetail: (id: string) => ['models', id] as const,
  keys: ['keys'] as const,
  keyDetail: (id: string) => ['keys', id] as const,
  aliases: ['aliases'] as const,
  routingRules: ['routing-rules'] as const,
  attributionSettings: ['settings', 'attribution'] as const,
  privacySettings: ['settings', 'privacy'] as const,
  requestLimits: ['settings', 'request-limits'] as const,
}

// ---- queries ----

export function useHealth(): UseQueryResult<ApiHealth> {
  return useQuery({
    queryKey: qk.health,
    queryFn: () => api.health(),
    refetchInterval: POLL_MS,
  })
}

export function useSystemStatus(): UseQueryResult<ApiSystemStatus> {
  return useQuery({
    queryKey: qk.systemStatus,
    queryFn: () => api.systemStatus(),
    refetchInterval: POLL_MS,
  })
}

export function useModels<T = Array<ApiModel>>(select?: (data: Array<ApiModel>) => T): UseQueryResult<T> {
  return useQuery({
    queryKey: qk.models,
    queryFn: () => api.listModels().then((r) => mergeModelTransitions(r.models)),
    refetchInterval: POLL_MS,
    select,
  })
}

export function useRunningModels() {
  return useModels((models) => models.filter((m) => m.running))
}

export function useRunningCount() {
  return useModels((models) => models.filter((m) => m.running).length)
}

export function useModelCounts() {
  return useModels((models) => ({
    running: models.filter((m) => m.running && m.kind !== 'peer').length,
    peers: models.filter((m) => m.kind === 'peer').length,
  }))
}

export function useRequestStats(): UseQueryResult<ApiRequestStats> {
  return useQuery({
    queryKey: qk.requestStats,
    queryFn: () => api.requestStats(),
    refetchInterval: POLL_MS,
  })
}

export function useRequestHistogram(): UseQueryResult<Array<ApiHistogramBucket>> {
  return useQuery({
    queryKey: qk.requestHistogram,
    queryFn: () => api.requestHistogram().then((r) => r.buckets),
    refetchInterval: POLL_MS,
  })
}

export function useGpu(): UseQueryResult<ApiGpuSnapshot> {
  return useQuery({
    queryKey: qk.gpu,
    queryFn: () => api.gpu(),
    refetchInterval: POLL_MS,
  })
}

export function useModelTimeline(): UseQueryResult<Array<ApiModelEvent>> {
  return useQuery({
    queryKey: qk.modelTimeline,
    queryFn: () => api.modelTimeline().then((r) => r.events),
    refetchInterval: POLL_MS,
  })
}

export function useModelDetail(id: string): UseQueryResult<ApiModelDetail> {
  return useQuery({
    queryKey: qk.modelDetail(id),
    queryFn: () => api.getModelDetail(id),
    refetchInterval: POLL_MS,
  })
}

export function useRecentRequests(limit = 10): UseQueryResult<Array<ApiRequest>> {
  return useQuery({
    queryKey: qk.requestsRecent(limit),
    queryFn: () => api.listRequests({ limit }).then((r) => r.requests),
    refetchInterval: POLL_MS,
  })
}

const PAGE_SIZE = 50

type RequestsPage = { requests: Array<ApiRequest>; nextCursor: string | null }

export function useRequestsList(): UseInfiniteQueryResult<{ pages: Array<RequestsPage>; pageParams: Array<unknown> }> {
  return useInfiniteQuery({
    queryKey: qk.requestsList,
    queryFn: ({ pageParam }) => api.listRequests({ limit: PAGE_SIZE, cursor: pageParam ?? undefined }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last: RequestsPage) => last.nextCursor ?? undefined,
    refetchInterval: POLL_MS,
  })
}

type RequestDetailResult = {
  request: ApiRequestDetail
  prevId: string | null
  nextId: string | null
}

export function useRequest(id: string): UseQueryResult<RequestDetailResult> {
  return useQuery({
    queryKey: qk.request(id),
    queryFn: () => api.getRequest(id),
    staleTime: Number.POSITIVE_INFINITY,
    placeholderData: keepPreviousData,
  })
}

// ---- optimistic model state ----

const pendingLoads = new Set<string>()
const pendingUnloads = new Set<string>()

function mergeModelTransitions(models: Array<ApiModel>): Array<ApiModel> {
  return models.map((m) => {
    if (pendingLoads.has(m.id)) {
      if (m.running) {
        pendingLoads.delete(m.id)
        return m
      }
      return { ...m, running: true, state: 'loading' }
    }
    if (pendingUnloads.has(m.id)) {
      if (!m.running) {
        pendingUnloads.delete(m.id)
        return m
      }
      return { ...m, state: 'stopping' }
    }
    return m
  })
}

// ---- mutations ----

export function useLoadModel(): UseMutationResult<{ ok: true }, Error, string> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.loadModel(id),
    onMutate: (id) => {
      pendingLoads.add(id)
      qc.setQueryData<Array<ApiModel>>(qk.models, (old) => old && mergeModelTransitions(old))
    },
    onSuccess: (_data, id) => {
      toast.success(`Loaded ${id}`)
      pendingLoads.delete(id)
      invalidateKeys(qc, [qk.models])
    },
    onError: (e, id) => {
      pendingLoads.delete(id)
      invalidateKeys(qc, [qk.models])
      toastMutationError('Load failed', e)
    },
  })
}

export function useUnloadModel(): UseMutationResult<{ ok: true }, Error, string> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.unloadModel(id),
    onMutate: (id) => {
      pendingUnloads.add(id)
      qc.setQueryData<Array<ApiModel>>(qk.models, (old) => old && mergeModelTransitions(old))
    },
    onSuccess: (_data, id) => {
      toast.success(`Unloaded ${id}`)
      pendingUnloads.delete(id)
      invalidateKeys(qc, [qk.models])
    },
    onError: (e, id) => {
      pendingUnloads.delete(id)
      invalidateKeys(qc, [qk.models])
      toastMutationError('Unload failed', e)
    },
  })
}

export function useUnloadAll(): UseMutationResult<{ ok: true }, Error, void> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.unloadAll(),
    onMutate: () => {
      const prev = qc.getQueryData<Array<ApiModel>>(qk.models)
      prev?.forEach((m) => {
        if (m.running) pendingUnloads.add(m.id)
      })
      qc.setQueryData<Array<ApiModel>>(qk.models, (old) => old && mergeModelTransitions(old))
    },
    onSuccess: () => {
      toast.success('Unloaded all models')
      pendingUnloads.clear()
      invalidateKeys(qc, [qk.models])
    },
    onError: (e) => {
      pendingUnloads.clear()
      invalidateKeys(qc, [qk.models])
      toastMutationError('Unload-all failed', e)
    },
  })
}

// ---- API keys ----

export function useKeyDetail(id: string): UseQueryResult<ApiKeyDetail> {
  return useQuery({
    queryKey: qk.keyDetail(id),
    queryFn: () => api.getKeyDetail(id),
    refetchInterval: POLL_MS,
  })
}

export function useApiKeys(): UseQueryResult<Array<ApiKeyItem>> {
  return useQuery({
    queryKey: qk.keys,
    queryFn: () => api.listKeys().then((r) => r.keys),
  })
}

export function useCreateApiKey(): UseMutationResult<ApiKeyCreated, Error, CreateApiKeyBody> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: CreateApiKeyBody) => api.createKey(body),
    onSuccess: () => {
      invalidateKeys(qc, [qk.keys])
    },
    onError: (e) => {
      toastMutationError('Failed to create key', e)
    },
  })
}

export function useRenameApiKey(): UseMutationResult<{ ok: true }, Error, { id: string; name: string }> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => api.renameKey(id, name),
    onSuccess: () => {
      invalidateKeys(qc, [qk.keys])
    },
    onError: (e) => {
      toastMutationError('Rename failed', e)
    },
  })
}

export function useUpdateKeyModels(): UseMutationResult<
  { ok: true },
  Error,
  { id: string; allowedModels: Array<string> }
> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, allowedModels }: { id: string; allowedModels: Array<string> }) =>
      api.updateKeyModels(id, allowedModels),
    onSuccess: (_data, { id }) => {
      invalidateKeys(qc, [qk.keys, qk.keyDetail(id)])
    },
    onError: (e) => {
      toastMutationError('Failed to update models', e)
    },
  })
}

export function useUpdateKeySystemPrompt(): UseMutationResult<
  { ok: true },
  Error,
  { id: string; systemPrompt: string | null }
> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, systemPrompt }: { id: string; systemPrompt: string | null }) =>
      api.updateKeySystemPrompt(id, systemPrompt),
    onSuccess: (_data, { id }) => {
      invalidateKeys(qc, [qk.keys, qk.keyDetail(id)])
    },
    onError: (e) => {
      toastMutationError('Failed to update system prompt', e)
    },
  })
}

export function useRevokeApiKey(): UseMutationResult<{ ok: true }, Error, string> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.revokeKey(id),
    onSuccess: () => {
      toast.success('API key revoked')
      invalidateKeys(qc, [qk.keys])
    },
    onError: (e) => {
      toastMutationError('Revoke failed', e)
    },
  })
}

export function useDeleteApiKey(): UseMutationResult<{ ok: true }, Error, string> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.deleteKey(id),
    onSuccess: () => {
      toast.success('API key deleted')
      invalidateKeys(qc, [qk.keys])
    },
    onError: (e) => {
      toastMutationError('Delete failed', e)
    },
  })
}

// ---- Model aliases ----

export function useAliases(): UseQueryResult<Array<ModelAliasItem>> {
  return useQuery({
    queryKey: qk.aliases,
    queryFn: () => api.listAliases().then((r) => r.aliases),
  })
}

export function useRoutingRules(): UseQueryResult<Array<RoutingRule>> {
  return useQuery({
    queryKey: qk.routingRules,
    queryFn: () => api.listRoutingRules().then((r) => r.rules),
  })
}

export function useCreateAlias(): UseMutationResult<ModelAliasItem, Error, CreateModelAliasBody> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: CreateModelAliasBody) => api.createAlias(body),
    onSuccess: () => {
      toast.success('Alias created')
      invalidateKeys(qc, [qk.aliases])
    },
    onError: (e) => {
      toastMutationError('Failed to create alias', e)
    },
  })
}

export function useUpdateAlias(): UseMutationResult<ModelAliasItem, Error, { id: string } & UpdateModelAliasBody> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & UpdateModelAliasBody) => api.updateAlias(id, body),
    onSuccess: () => {
      toast.success('Alias updated')
      invalidateKeys(qc, [qk.aliases])
    },
    onError: (e) => {
      toastMutationError('Failed to update alias', e)
    },
  })
}

export function useDeleteAlias(): UseMutationResult<{ ok: true }, Error, string> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.deleteAlias(id),
    onSuccess: () => {
      toast.success('Alias deleted')
      invalidateKeys(qc, [qk.aliases])
    },
    onError: (e) => {
      toastMutationError('Failed to delete alias', e)
    },
  })
}

export function useCreateRoutingRule(): UseMutationResult<RoutingRule, Error, CreateRoutingRuleBody> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body) => api.createRoutingRule(body),
    onSuccess: () => {
      invalidateKeys(qc, [qk.routingRules])
    },
    onError: (e) => {
      toastMutationError('Failed to create routing rule', e)
    },
  })
}

export function useUpdateRoutingRule(): UseMutationResult<
  RoutingRule,
  Error,
  { id: string; body: UpdateRoutingRuleBody }
> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }) => api.updateRoutingRule(id, body),
    onSuccess: () => {
      invalidateKeys(qc, [qk.routingRules])
    },
    onError: (e) => {
      toastMutationError('Failed to update routing rule', e)
    },
  })
}

export function useDeleteRoutingRule(): UseMutationResult<{ ok: true }, Error, string> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id) => api.deleteRoutingRule(id),
    onSuccess: () => {
      invalidateKeys(qc, [qk.routingRules])
    },
    onError: (e) => {
      toastMutationError('Failed to delete routing rule', e)
    },
  })
}

export function useReorderRoutingRules(): UseMutationResult<Array<RoutingRule>, Error, string[]> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (ids) => api.reorderRoutingRules(ids).then((r) => r.rules),
    onSuccess: (rules) => {
      qc.setQueryData<Array<RoutingRule>>(qk.routingRules, rules)
      invalidateKeys(qc, [qk.routingRules])
    },
    onError: (e) => {
      toastMutationError('Failed to reorder routing rules', e)
    },
  })
}

// ---- Request limits ----

export function useRequestLimits(): UseQueryResult<RequestLimits> {
  return useQuery({
    queryKey: qk.requestLimits,
    queryFn: () => api.getRequestLimits(),
  })
}

export function useAttributionSettings(): UseQueryResult<AttributionSettings> {
  return useQuery({
    queryKey: qk.attributionSettings,
    queryFn: () => api.getAttributionSettings(),
  })
}

export function usePrivacySettings(): UseQueryResult<PrivacySettings> {
  return useQuery({
    queryKey: qk.privacySettings,
    queryFn: () => api.getPrivacySettings(),
  })
}

export function useUpdateRequestLimits(): UseMutationResult<RequestLimits, Error, UpdateRequestLimitsBody> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: UpdateRequestLimitsBody) => api.updateRequestLimits(body),
    onSuccess: () => {
      toast.success('Request limits updated')
      invalidateKeys(qc, [qk.requestLimits])
    },
    onError: (e) => {
      toastMutationError('Failed to update limits', e)
    },
  })
}

export function useUpdateAttributionSettings(): UseMutationResult<
  AttributionSettings,
  Error,
  UpdateAttributionSettingsBody
> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body) => api.updateAttributionSettings(body),
    onSuccess: (settings) => {
      qc.setQueryData(qk.attributionSettings, settings)
      invalidateKeys(qc, [qk.attributionSettings])
      toast.success('Attribution settings updated')
    },
    onError: (e) => {
      toastMutationError('Failed to update attribution settings', e)
    },
  })
}

export function useUpdatePrivacySettings(): UseMutationResult<PrivacySettings, Error, UpdatePrivacySettingsBody> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body) => api.updatePrivacySettings(body),
    onSuccess: (settings) => {
      qc.setQueryData(qk.privacySettings, settings)
      invalidateKeys(qc, [qk.privacySettings])
      toast.success('Privacy settings updated')
    },
    onError: (e) => {
      toastMutationError('Failed to update privacy settings', e)
    },
  })
}
