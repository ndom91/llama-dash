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
    queryClient.setQueryData<Array<ApiRequest>>(queryKey, (old) => {
      if (!old || old.some((row) => row.id === request.id)) return old
      return [request, ...old].slice(0, limit)
    })
  }
}

function updateRequestsListCache(queryClient: QueryClient, request: ApiRequest) {
  queryClient.setQueryData<{ pages: Array<RequestsPage>; pageParams: Array<unknown> }>(qk.requestsList, (old) => {
    if (!old?.pages[0] || old.pages[0].requests.some((row) => row.id === request.id)) return old
    const firstPage = old.pages[0]
    return {
      ...old,
      pages: [{ ...firstPage, requests: [request, ...firstPage.requests] }, ...old.pages.slice(1)],
    }
  })
}

export function useAdminEvents() {
  const queryClient = useQueryClient()

  useEffect(() => {
    const events = new EventSource('/api/events')

    const updateRequests = (event: MessageEvent) => {
      const data = parseEventData(RequestCompletedEventSchema, event)
      if (!data) {
        queryClient.invalidateQueries({ queryKey: qk.requestStats })
        queryClient.invalidateQueries({ queryKey: qk.requests })
        return
      }

      queryClient.invalidateQueries({ queryKey: qk.requestStats })
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

    return () => events.close()
  }, [queryClient])
}
