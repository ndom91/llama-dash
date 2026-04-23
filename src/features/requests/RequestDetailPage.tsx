import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { TopBar } from '../../components/TopBar'
import { api } from '../../lib/api'
import { qk, useRequest } from '../../lib/queries'
import { RequestDetailContent } from './RequestDetailContent'
import { RequestDetailSkeleton } from './RequestDetailSkeleton'

type Props = {
  id: string
}

const PREFETCH_BODY_THRESHOLD = 64 * 1024

export function RequestDetailPage({ id }: Props) {
  const qc = useQueryClient()
  const { data, error, isFetching, isPlaceholderData } = useRequest(id)
  const req = data?.request
  const prevId = data?.prevId ?? null
  const nextId = data?.nextId ?? null
  const isTransitioning = isPlaceholderData && req?.id !== id
  const isPrevPending = isTransitioning && id === prevId
  const isNextPending = isTransitioning && id === nextId

  useEffect(() => {
    if (!req) return

    const bodySize = (req.requestBody?.length ?? 0) + (req.responseBody?.length ?? 0)
    if (bodySize > PREFETCH_BODY_THRESHOLD) return

    const prefetch = (requestId: string | null) => {
      if (!requestId) return
      qc.prefetchQuery({
        queryKey: qk.request(requestId),
        queryFn: () => api.getRequest(requestId),
        staleTime: Number.POSITIVE_INFINITY,
      })
    }

    prefetch(prevId)
    prefetch(nextId)
  }, [nextId, prevId, qc, req])

  return (
    <div className="main-col">
      <TopBar />
      <div className="content">
        <div className="page min-h-full">
          {error ? (
            <div className="err-banner mx-6 mt-3 max-md:mx-3">{error.message}</div>
          ) : req == null ? (
            <RequestDetailSkeleton />
          ) : (
            <>
              <RequestDetailContent
                req={req}
                prevId={prevId}
                nextId={nextId}
                isPrevPending={isPrevPending}
                isNextPending={isNextPending}
              />
              {isFetching && !isTransitioning ? (
                <div className="mx-6 mt-3 font-mono text-[11px] text-fg-dim max-md:mx-3">
                  refreshing request detail…
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
