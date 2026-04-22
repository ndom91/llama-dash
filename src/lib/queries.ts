import {
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
  type ModelAliasItem,
  type RequestLimits,
} from './api'
import type { CreateApiKeyBody } from './schemas/api-key'
import type { CreateModelAliasBody, UpdateModelAliasBody } from './schemas/model-alias'
import type { UpdateRequestLimitsBody } from './schemas/settings'

const POLL_MS = 5_000

export const qk = {
  health: ['health'] as const,
  models: ['models'] as const,
  requests: ['requests'] as const,
  requestsList: ['requests', 'list'] as const,
  requestsRecent: ['requests', 'recent'] as const,
  requestStats: ['requests', 'stats'] as const,
  requestHistogram: ['requests', 'histogram'] as const,
  gpu: ['gpu'] as const,
  modelTimeline: ['model-timeline'] as const,
  request: (id: string) => ['requests', id] as const,
  modelDetail: (id: string) => ['models', id] as const,
  keys: ['keys'] as const,
  keyDetail: (id: string) => ['keys', id] as const,
  aliases: ['aliases'] as const,
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
    queryKey: qk.requestsRecent,
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
  const qc = useQueryClient()
  return useQuery({
    queryKey: qk.request(id),
    queryFn: () => api.getRequest(id),
    staleTime: Number.POSITIVE_INFINITY,
    placeholderData: (prev) => {
      const lists = qc.getQueryData<{ pages: Array<RequestsPage> }>(qk.requestsList)
      const recent = qc.getQueryData<Array<ApiRequest>>(qk.requestsRecent)
      const all = [...(lists?.pages.flatMap((p) => p.requests) ?? []), ...(recent ?? [])]
      const match = all.find((r) => r.id === id)
      if (match) return { request: match as ApiRequestDetail, prevId: null, nextId: null }
      return prev
    },
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
      qc.invalidateQueries({ queryKey: qk.models })
    },
    onError: (e, id) => {
      pendingLoads.delete(id)
      qc.invalidateQueries({ queryKey: qk.models })
      toast.error('Load failed', { description: e.message })
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
      qc.invalidateQueries({ queryKey: qk.models })
    },
    onError: (e, id) => {
      pendingUnloads.delete(id)
      qc.invalidateQueries({ queryKey: qk.models })
      toast.error('Unload failed', { description: e.message })
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
      qc.invalidateQueries({ queryKey: qk.models })
    },
    onError: (e) => {
      pendingUnloads.clear()
      qc.invalidateQueries({ queryKey: qk.models })
      toast.error('Unload-all failed', { description: e.message })
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
      qc.invalidateQueries({ queryKey: qk.keys })
    },
    onError: (e) => {
      toast.error('Failed to create key', { description: e.message })
    },
  })
}

export function useRenameApiKey(): UseMutationResult<{ ok: true }, Error, { id: string; name: string }> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => api.renameKey(id, name),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.keys })
    },
    onError: (e) => {
      toast.error('Rename failed', { description: e.message })
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
      qc.invalidateQueries({ queryKey: qk.keys })
      qc.invalidateQueries({ queryKey: qk.keyDetail(id) })
    },
    onError: (e) => {
      toast.error('Failed to update models', { description: e.message })
    },
  })
}

export function useUpdateKeyDefaultModel(): UseMutationResult<
  { ok: true },
  Error,
  { id: string; defaultModel: string | null }
> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, defaultModel }: { id: string; defaultModel: string | null }) =>
      api.updateKeyDefaultModel(id, defaultModel),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: qk.keys })
      qc.invalidateQueries({ queryKey: qk.keyDetail(id) })
    },
    onError: (e) => {
      toast.error('Failed to update default model', { description: e.message })
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
      qc.invalidateQueries({ queryKey: qk.keys })
      qc.invalidateQueries({ queryKey: qk.keyDetail(id) })
    },
    onError: (e) => {
      toast.error('Failed to update system prompt', { description: e.message })
    },
  })
}

export function useRevokeApiKey(): UseMutationResult<{ ok: true }, Error, string> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.revokeKey(id),
    onSuccess: () => {
      toast.success('API key revoked')
      qc.invalidateQueries({ queryKey: qk.keys })
    },
    onError: (e) => {
      toast.error('Revoke failed', { description: e.message })
    },
  })
}

export function useDeleteApiKey(): UseMutationResult<{ ok: true }, Error, string> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.deleteKey(id),
    onSuccess: () => {
      toast.success('API key deleted')
      qc.invalidateQueries({ queryKey: qk.keys })
    },
    onError: (e) => {
      toast.error('Delete failed', { description: e.message })
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

export function useCreateAlias(): UseMutationResult<ModelAliasItem, Error, CreateModelAliasBody> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: CreateModelAliasBody) => api.createAlias(body),
    onSuccess: () => {
      toast.success('Alias created')
      qc.invalidateQueries({ queryKey: qk.aliases })
    },
    onError: (e) => {
      toast.error('Failed to create alias', { description: e.message })
    },
  })
}

export function useUpdateAlias(): UseMutationResult<ModelAliasItem, Error, { id: string } & UpdateModelAliasBody> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & UpdateModelAliasBody) => api.updateAlias(id, body),
    onSuccess: () => {
      toast.success('Alias updated')
      qc.invalidateQueries({ queryKey: qk.aliases })
    },
    onError: (e) => {
      toast.error('Failed to update alias', { description: e.message })
    },
  })
}

export function useDeleteAlias(): UseMutationResult<{ ok: true }, Error, string> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.deleteAlias(id),
    onSuccess: () => {
      toast.success('Alias deleted')
      qc.invalidateQueries({ queryKey: qk.aliases })
    },
    onError: (e) => {
      toast.error('Failed to delete alias', { description: e.message })
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

export function useUpdateRequestLimits(): UseMutationResult<RequestLimits, Error, UpdateRequestLimitsBody> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: UpdateRequestLimitsBody) => api.updateRequestLimits(body),
    onSuccess: () => {
      toast.success('Request limits updated')
      qc.invalidateQueries({ queryKey: qk.requestLimits })
    },
    onError: (e) => {
      toast.error('Failed to update limits', { description: e.message })
    },
  })
}
