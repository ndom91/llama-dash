import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import * as v from 'valibot'
import { qk } from './queries'
import { GpuSnapshotSchema } from './schemas/gpu'
import { ApiRequestSchema, type ApiRequest } from './schemas/request'

type RequestsPage = { requests: Array<ApiRequest>; nextCursor: string | null }

const RequestCompletedEventSchema = v.object({ request: ApiRequestSchema })

export function useAdminEvents() {
  const queryClient = useQueryClient()

  useEffect(() => {
    const events = new EventSource('/api/events')

    const updateRequests = (event: MessageEvent) => {
      const result = v.safeParse(RequestCompletedEventSchema, JSON.parse(event.data))
      if (!result.success) {
        queryClient.invalidateQueries({ queryKey: qk.requestStats })
        queryClient.invalidateQueries({ queryKey: qk.requests })
        return
      }

      const request = result.output.request
      queryClient.invalidateQueries({ queryKey: qk.requestStats })
      queryClient.setQueriesData<Array<ApiRequest>>({ queryKey: qk.requests, exact: false }, (old) => {
        if (!old || old.some((row) => row.id === request.id)) return old
        return [request, ...old]
      })
      queryClient.setQueryData<{ pages: Array<RequestsPage>; pageParams: Array<unknown> }>(qk.requestsList, (old) => {
        if (!old?.pages[0] || old.pages[0].requests.some((row) => row.id === request.id)) return old
        const firstPage = old.pages[0]
        return {
          ...old,
          pages: [{ ...firstPage, requests: [request, ...firstPage.requests] }, ...old.pages.slice(1)],
        }
      })
    }

    const invalidateModels = () => {
      queryClient.invalidateQueries({ queryKey: qk.models })
      queryClient.invalidateQueries({ queryKey: qk.modelTimeline })
      queryClient.invalidateQueries({ queryKey: qk.systemStatus })
    }

    const updateGpu = (event: MessageEvent) => {
      const result = v.safeParse(GpuSnapshotSchema, JSON.parse(event.data))
      if (result.success) queryClient.setQueryData(qk.gpu, result.output)
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
