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
import { api, type ApiHealth, type ApiModel, type ApiRequest, type ApiRequestDetail } from './api'

const POLL_MS = 5_000

export const qk = {
  health: ['health'] as const,
  models: ['models'] as const,
  requests: ['requests'] as const,
  requestsList: ['requests', 'list'] as const,
  requestsRecent: ['requests', 'recent'] as const,
  request: (id: string) => ['requests', id] as const,
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
