import { useQueryClient } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import * as v from 'valibot'
import type { BaseIssue, BaseSchema } from 'valibot'
import { qk } from './queries'
import { GpuSnapshotSchema } from './schemas/gpu'
import { ApiRequestSchema, InflightRequestSchema, type ApiRequest, type InflightRequest } from './schemas/request'

type RequestsPage = { requests: Array<ApiRequest>; nextCursor: string | null }

const RequestCompletedEventSchema = v.object({ request: ApiRequestSchema })
const RequestStartedEventSchema = v.object({ request: InflightRequestSchema })
const RequestUpdatedEventSchema = v.object({ request: InflightRequestSchema })
const REQUEST_STATS_INVALIDATE_MS = 1_000

type AnySchema = BaseSchema<unknown, unknown, BaseIssue<unknown>>

function parseEventData<T extends AnySchema>(schema: T, event: MessageEvent): v.InferOutput<T> | null {
  try {
    const result = v.safeParse(schema, JSON.parse(event.data))
    return result.success ? result.output : null
  } catch {
    return null
  }
}

function updateRecentRequestCaches(queryClient: QueryClient, request: ApiRequest) {
  for (const query of queryClient.getQueryCache().findAll({ queryKey: qk.requests, exact: false })) {
    const queryKey = query.queryKey
    if (queryKey[0] !== 'requests' || queryKey[1] !== 'recent' || typeof queryKey[2] !== 'number') continue
    const limit = queryKey[2]
    const includeMcp = queryKey[3] === true
    queryClient.setQueryData<Array<ApiRequest>>(queryKey, (old) => {
      if (!includeMcp && isMcpRelayRequest(request)) return old
      if (!old || old.some((row) => row.id === request.id)) return old
      return [request, ...old].slice(0, limit)
    })
  }
}

function updateRequestsListCache(queryClient: QueryClient, request: ApiRequest) {
  for (const query of queryClient.getQueryCache().findAll({ queryKey: qk.requestsList, exact: false })) {
    const queryKey = query.queryKey
    if (queryKey[0] !== 'requests' || queryKey[1] !== 'list') continue
    queryClient.setQueryData<{ pages: Array<RequestsPage>; pageParams: Array<unknown> }>(queryKey, (old) => {
      if (!old?.pages[0] || old.pages[0].requests.some((row) => row.id === request.id)) return old
      const firstPage = old.pages[0]
      return {
        ...old,
        pages: [{ ...firstPage, requests: [request, ...firstPage.requests] }, ...old.pages.slice(1)],
      }
    })
  }
}

function upsertInflightCache(queryClient: QueryClient, request: InflightRequest) {
  queryClient.setQueryData<Array<InflightRequest>>(qk.requestsInflight, (old) => {
    const rows = old ?? []
    const idx = rows.findIndex((row) => row.id === request.id)
    if (idx === -1) return [request, ...rows]
    const next = rows.slice()
    next[idx] = request
    return next
  })
}

function removeInflightCache(queryClient: QueryClient, id: string) {
  queryClient.setQueryData<Array<InflightRequest>>(qk.requestsInflight, (old) => {
    if (!old?.length) return old
    return old.filter((row) => row.id !== id)
  })
}

function isMcpRelayRequest(request: ApiRequest): boolean {
  return request.requestClass === 'mcp_relay'
}

export function useAdminEvents() {
  const queryClient = useQueryClient()

  useEffect(() => {
    const events = new EventSource('/api/events')
    let requestStatsTimer: ReturnType<typeof setTimeout> | null = null

    const scheduleRequestStatsInvalidation = () => {
      if (requestStatsTimer) return
      requestStatsTimer = setTimeout(() => {
        requestStatsTimer = null
        queryClient.invalidateQueries({ queryKey: qk.requestStats })
      }, REQUEST_STATS_INVALIDATE_MS)
    }

    const updateRequests = (event: MessageEvent) => {
      const data = parseEventData(RequestCompletedEventSchema, event)
      if (!data) {
        scheduleRequestStatsInvalidation()
        queryClient.invalidateQueries({ queryKey: qk.requests })
        return
      }

      scheduleRequestStatsInvalidation()
      removeInflightCache(queryClient, data.request.id)
      updateRecentRequestCaches(queryClient, data.request)
      updateRequestsListCache(queryClient, data.request)
    }

    const onRequestStarted = (event: MessageEvent) => {
      const data = parseEventData(RequestStartedEventSchema, event)
      if (!data) {
        queryClient.invalidateQueries({ queryKey: qk.requestsInflight })
        return
      }
      upsertInflightCache(queryClient, data.request)
    }

    const onRequestUpdated = (event: MessageEvent) => {
      const data = parseEventData(RequestUpdatedEventSchema, event)
      if (!data) {
        queryClient.invalidateQueries({ queryKey: qk.requestsInflight })
        return
      }
      upsertInflightCache(queryClient, data.request)
    }

    const invalidateModels = () => {
      queryClient.invalidateQueries({ queryKey: qk.models })
      queryClient.invalidateQueries({ queryKey: qk.modelTimeline })
      queryClient.invalidateQueries({ queryKey: qk.systemStatus })
    }

    const updateGpu = (event: MessageEvent) => {
      const data = parseEventData(GpuSnapshotSchema, event)
      if (data) queryClient.setQueryData(qk.gpu, data)
    }

    const invalidateSystem = () => {
      queryClient.invalidateQueries({ queryKey: qk.systemStatus })
      queryClient.invalidateQueries({ queryKey: qk.health })
    }

    events.addEventListener('request.completed', updateRequests)
    events.addEventListener('request.started', onRequestStarted)
    events.addEventListener('request.updated', onRequestUpdated)
    events.addEventListener('model.changed', invalidateModels)
    events.addEventListener('gpu.updated', updateGpu)
    events.addEventListener('system.changed', invalidateSystem)

    return () => {
      events.close()
      if (requestStatsTimer) clearTimeout(requestStatsTimer)
    }
  }, [queryClient])
}
