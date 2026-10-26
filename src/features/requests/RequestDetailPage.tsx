import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { RouteError } from '../../components/RouteError'
import { requestQueryOptions, useRequest } from '../../lib/queries'
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

  useEffect(() => {
    if (!req || isPlaceholderData) return

    const bodySize = (req.requestBody?.length ?? 0) + (req.responseBody?.length ?? 0)
    if (bodySize > PREFETCH_BODY_THRESHOLD) return

    const prefetch = (requestId: string | null) => {
      if (!requestId) return
      void qc.prefetchQuery(requestQueryOptions(requestId))
    }

    prefetch(prevId)
    prefetch(nextId)
  }, [isPlaceholderData, nextId, prevId, qc, req])

  if (error) {
    return <RouteError kicker="dsh · requests" title="Failed to load request" message={error.message} />
  }

  return (
    <div className="content">
      <div className="page min-h-full">
        {req == null ? (
          <RequestDetailSkeleton />
        ) : (
          <>
            <RequestDetailContent req={req} prevId={prevId} nextId={nextId} isDetailLoading={isPlaceholderData} />
            {isFetching && !isPlaceholderData ? (
              <div className="mx-6 mt-3 font-mono text-[11px] text-fg-dim max-md:mx-3">refreshing request detail…</div>
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}
