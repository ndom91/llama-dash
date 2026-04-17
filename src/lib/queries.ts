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

export function useHealth(): UseQueryResult<ApiHealth> {
  return useQuery({
    queryKey: qk.health,
    queryFn: () => api.health(),
    refetchInterval: POLL_MS,
  })
}

export function useModels(): UseQueryResult<Array<ApiModel>> {
  return useQuery({
    queryKey: qk.models,
    queryFn: () => api.listModels().then((r) => r.models),
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
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (last: RequestsPage) => last.nextCursor ?? undefined,
  })
}

export function useRequest(id: number): UseQueryResult<ApiRequestDetail> {
  return useQuery({
    queryKey: qk.request(id),
    queryFn: () => api.getRequest(id).then((r) => r.request),
  })
}

export function useLoadModel(): UseMutationResult<{ ok: true }, Error, string> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.loadModel(id),
    onSuccess: (_data, id) => {
      toast.success(`Loaded ${id}`)
      qc.invalidateQueries({ queryKey: qk.models })
    },
    onError: (e) => {
      toast.error('Load failed', { description: e.message })
    },
  })
}

export function useUnloadModel(): UseMutationResult<{ ok: true }, Error, string> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.unloadModel(id),
    onSuccess: (_data, id) => {
      toast.success(`Unloaded ${id}`)
      qc.invalidateQueries({ queryKey: qk.models })
    },
    onError: (e) => {
      toast.error('Unload failed', { description: e.message })
    },
  })
}

export function useUnloadAll(): UseMutationResult<{ ok: true }, Error, void> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.unloadAll(),
    onSuccess: () => {
      toast.success('Unloaded all models')
      qc.invalidateQueries({ queryKey: qk.models })
    },
    onError: (e) => {
      toast.error('Unload-all failed', { description: e.message })
    },
  })
}
