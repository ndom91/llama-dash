import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { RouteError } from '../../components/RouteError'
import { requestQueryOptions, useRequest, useRequestPayloads } from '../../lib/queries'
import { RequestDetailContent } from './RequestDetailContent'
import { RequestDetailSkeleton } from './RequestDetailSkeleton'

type Props = {
  id: string
}

export function RequestDetailPage({ id }: Props) {
  const qc = useQueryClient()
  const { data, error, isFetching, isPlaceholderData } = useRequest(id)
  const payloads = useRequestPayloads(id)
  const req = data
    ? {
        ...data.request,
        requestHeaders: null,
        requestBody: null,
        responseHeaders: null,
        responseBody: null,
        ...payloads.data,
      }
    : undefined
  const prevId = data?.prevId ?? null
  const nextId = data?.nextId ?? null

  useEffect(() => {
    if (!data || isPlaceholderData) return

    const prefetch = (requestId: string | null) => {
      if (!requestId) return
      void qc.prefetchQuery(requestQueryOptions(requestId, 'low'))
    }

    prefetch(prevId)
    prefetch(nextId)
  }, [isPlaceholderData, nextId, prevId, qc, data])

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
            <RequestDetailContent
              req={req}
              prevId={prevId}
              nextId={nextId}
              isDetailLoading={isPlaceholderData || !payloads.data}
              isMetadataLoading={isPlaceholderData}
              payloadError={payloads.error?.message}
              onRetryPayloads={() => {
                void payloads.refetch()
              }}
            />
            {isFetching && !isPlaceholderData ? (
              <div className="mx-6 mt-3 font-mono text-[11px] text-fg-dim max-md:mx-3">refreshing request detail…</div>
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}
