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
  type ApiKeyItem,
  type ApiModel,
  type ApiModelDetail,
  type ApiModelEvent,
  type ApiRequest,
  type ApiRequestDetail,
  type ApiRequestStats,
} from './api'
import type { CreateApiKeyBody } from './schemas/api-key'

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
    queryFn: () => api.listModels().then((r) => r.models),
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
    refetchInterval: POLL_MS,
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

// ---- mutations ----

function setModelState(qc: ReturnType<typeof useQueryClient>, id: string, running: boolean, state: string) {
  qc.setQueryData<Array<ApiModel>>(qk.models, (old) => old?.map((m) => (m.id === id ? { ...m, running, state } : m)))
}

export function useLoadModel(): UseMutationResult<{ ok: true }, Error, string> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.loadModel(id),
    onMutate: (id) => {
      const prev = qc.getQueryData<Array<ApiModel>>(qk.models)
      setModelState(qc, id, true, 'loading')
      return { prev }
    },
    onSuccess: (_data, id) => {
      toast.success(`Loaded ${id}`)
      qc.invalidateQueries({ queryKey: qk.models })
    },
    onError: (e, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(qk.models, ctx.prev)
      toast.error('Load failed', { description: e.message })
    },
  })
}

export function useUnloadModel(): UseMutationResult<{ ok: true }, Error, string> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.unloadModel(id),
    onMutate: (id) => {
      const prev = qc.getQueryData<Array<ApiModel>>(qk.models)
      setModelState(qc, id, false, 'stopped')
      return { prev }
    },
    onSuccess: (_data, id) => {
      toast.success(`Unloaded ${id}`)
      qc.invalidateQueries({ queryKey: qk.models })
    },
    onError: (e, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(qk.models, ctx.prev)
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
      qc.setQueryData<Array<ApiModel>>(qk.models, (old) =>
        old?.map((m) => (m.running ? { ...m, running: false, state: 'stopped' } : m)),
      )
      return { prev }
    },
    onSuccess: () => {
      toast.success('Unloaded all models')
      qc.invalidateQueries({ queryKey: qk.models })
    },
    onError: (e, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(qk.models, ctx.prev)
      toast.error('Unload-all failed', { description: e.message })
    },
  })
}

// ---- API keys ----

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
