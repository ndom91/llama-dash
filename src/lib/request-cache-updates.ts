import type { QueryClient } from '@tanstack/react-query'
import { qk, REQUESTS_PAGE_SIZE } from './queries'
import type { ApiRequest } from './schemas/request'
import type { RequestPayloadsSchema } from './schemas/request'
import type { InferOutput } from 'valibot'

type RequestsPage = { requests: Array<ApiRequest>; nextCursor: string | null }
type RequestsList = { pages: Array<RequestsPage>; pageParams: Array<unknown> }

export function trimInactiveRequestPayloads(client: QueryClient) {
  const queries = client
    .getQueryCache()
    .findAll({ queryKey: ['request-payloads'] })
    .sort((a, b) => a.state.dataUpdatedAt - b.state.dataUpdatedAt)
  const size = (data: unknown) =>
    Object.values((data ?? {}) as Partial<InferOutput<typeof RequestPayloadsSchema>>).reduce(
      (bytes, value) => bytes + (value?.length ?? 0) * 2,
      0,
    )
  let bytes = queries.reduce((total, query) => total + size(query.state.data), 0)
  let count = queries.length
  for (const query of queries) {
    if (bytes <= 16 * 1024 * 1024 && count <= 8) break
    if (query.getObserversCount() > 0) continue
    bytes -= size(query.state.data)
    count--
    client.removeQueries({ queryKey: query.queryKey, exact: true })
  }
}

export function updateRequestsListCache(client: QueryClient, request: ApiRequest) {
  client.setQueryData<RequestsList>(qk.requestsList, (old) => {
    if (!old?.pages.length || old.pages.some((page) => page.requests.some((row) => row.id === request.id))) return old
    const rows = [request, ...old.pages.flatMap((page) => page.requests)].sort((a, b) => b.id.localeCompare(a.id))
    const capacity = old.pages.length * REQUESTS_PAGE_SIZE
    const pages = old.pages.map((page, index) => {
      const requests = rows.slice(index * REQUESTS_PAGE_SIZE, (index + 1) * REQUESTS_PAGE_SIZE)
      const hasMore = index < old.pages.length - 1 || rows.length > capacity || page.nextCursor !== null
      return { ...page, requests, nextCursor: hasMore ? (requests.at(-1)?.id ?? null) : null }
    })
    return {
      pages,
      pageParams: pages.map((_, index) => (index === 0 ? undefined : (pages[index - 1].nextCursor ?? undefined))),
    }
  })
}

export function invalidateRequestLists(client: QueryClient) {
  void client.invalidateQueries({ queryKey: qk.requestsList })
  void client.invalidateQueries({ queryKey: ['requests', 'recent'] })
}

export function resyncLiveQueries(client: QueryClient) {
  invalidateRequestLists(client)
  for (const queryKey of [
    qk.models,
    qk.keys,
    qk.modelTimeline,
    qk.systemStatus,
    qk.health,
    qk.gpu,
    qk.requestStats,
    qk.requestHistogram,
  ]) {
    void client.invalidateQueries({ queryKey })
  }
}
