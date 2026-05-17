import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import * as v from 'valibot'
import { qk } from './queries'
import { GpuSnapshotSchema } from './schemas/gpu'

export function useAdminEvents() {
  const queryClient = useQueryClient()

  useEffect(() => {
    const events = new EventSource('/api/events')

    const invalidateRequests = () => {
      queryClient.invalidateQueries({ queryKey: qk.requestStats })
      queryClient.invalidateQueries({ queryKey: qk.requests })
      queryClient.invalidateQueries({ queryKey: qk.models })
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

    events.addEventListener('request.completed', invalidateRequests)
    events.addEventListener('model.changed', invalidateModels)
    events.addEventListener('gpu.updated', updateGpu)
    events.addEventListener('system.changed', invalidateSystem)

    return () => events.close()
  }, [queryClient])
}
