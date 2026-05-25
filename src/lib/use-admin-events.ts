import { useQueryClient } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import * as v from 'valibot'
import type { BaseIssue, BaseSchema } from 'valibot'
import { qk } from './queries'
import { GpuSnapshotSchema } from './schemas/gpu'
import { ApiRequestSchema, type ApiRequest } from './schemas/request'

type RequestsPage = { requests: Array<ApiRequest>; nextCursor: string | null }

const RequestCompletedEventSchema = v.object({ request: ApiRequestSchema })
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
      updateRecentRequestCaches(queryClient, data.request)
      updateRequestsListCache(queryClient, data.request)
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
    events.addEventListener('model.changed', invalidateModels)
    events.addEventListener('gpu.updated', updateGpu)
    events.addEventListener('system.changed', invalidateSystem)

    return () => {
      events.close()
      if (requestStatsTimer) clearTimeout(requestStatsTimer)
    }
  }, [queryClient])
}
