import type { QueryClient } from '@tanstack/react-query'
import type { InferOutput } from 'valibot'
import { qk } from './query-keys'
import { applyRequestFilters, isMcpRelayRequest } from './request-filters'
import type { RequestListQuery } from './request-query-data'
import { REQUESTS_PAGE_SIZE, type RequestsList } from './request-query-data'
import { compareRequests, requestCursor } from './request-sort'
import type { ApiRequest, RequestPayloadsSchema } from './schemas/request'

export function trimInactiveRequestPayloads(client: QueryClient) {
  const queries = client
    .getQueryCache()
    .findAll({ queryKey: qk.requestPayloadsRoot })
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
  client.setQueryData<{ models: string[]; keys: string[]; hosts: string[] }>(qk.requestFilterOptions, (old) => {
    if (!old) return old
    const add = (values: string[], value: string | null) =>
      value && !values.includes(value) ? [...values, value].sort() : values
    const models = add(old.models, request.model)
    const keys = add(old.keys, request.keyName)
    const hosts = add(old.hosts, request.clientHost)
    return models === old.models && keys === old.keys && hosts === old.hosts ? old : { models, keys, hosts }
  })
  const minute = Math.floor(Date.parse(request.startedAt) / 60_000) * 60_000
  const keys = [
    qk.requestsList,
    ...client
      .getQueryCache()
      .findAll({ queryKey: qk.requestsFilteredList })
      .filter((query) => {
        const minutes = query.queryKey[2]
        const status = query.queryKey[3]
        const filters = query.queryKey[4] as RequestListQuery | undefined
        if (typeof minutes !== 'string' || (minutes && !minutes.split(',').includes(String(minute)))) return false
        if (status === 'err' && request.statusCode < 400) return false
        if (status === 'ok' && (request.statusCode < 200 || request.statusCode >= 400)) return false
        if (!filters) return true
        if (!filters.includeMcp && isMcpRelayRequest(request)) return false
        return applyRequestFilters([request], { ...filters, statusFilter: 'all' }).length > 0
      })
      .map((query) => query.queryKey),
  ]
  for (const key of keys)
    client.setQueryData<RequestsList>(key, (old) => {
      if (!old?.pages.length || old.pages.some((page) => page.requests.some((row) => row.id === request.id))) return old
      const sort = key[4] as RequestListQuery | undefined
      const rows = [request, ...old.pages.flatMap((page) => page.requests)].sort((a, b) => compareRequests(a, b, sort))
      const capacity = old.pages.length * REQUESTS_PAGE_SIZE
      const pages = old.pages.map((page, index) => {
        const requests = rows.slice(index * REQUESTS_PAGE_SIZE, (index + 1) * REQUESTS_PAGE_SIZE)
        const hasMore = index < old.pages.length - 1 || rows.length > capacity || page.nextCursor !== null
        return {
          ...page,
          requests,
          nextCursor: hasMore && requests.length ? requestCursor(requests[requests.length - 1], sort) : null,
        }
      })
      return {
        pages,
        pageParams: pages.map((_, index) => (index === 0 ? undefined : (pages[index - 1].nextCursor ?? undefined))),
      }
    })
}

export function invalidateRequestLists(client: QueryClient) {
  void client.invalidateQueries({ queryKey: qk.requestsList })
  void client.invalidateQueries({ queryKey: qk.requestsFilteredList })
  void client.invalidateQueries({ queryKey: qk.requestsRecentRoot })
}

export function invalidateRequestKeyNames(client: QueryClient) {
  invalidateRequestLists(client)
  void client.invalidateQueries({ queryKey: qk.requestFilterOptions })
  void client.invalidateQueries({ queryKey: qk.keys })
}

export function resyncLiveQueries(client: QueryClient) {
  invalidateRequestLists(client)
  for (const queryKey of [
    qk.models,
    qk.keys,
    qk.requestFilterOptions,
    qk.modelTimeline,
    qk.modelActivity,
    qk.systemStatus,
    qk.health,
    qk.gpu,
    qk.requestStats,
    qk.requestHistogram,
  ]) {
    void client.invalidateQueries({ queryKey })
  }
}
