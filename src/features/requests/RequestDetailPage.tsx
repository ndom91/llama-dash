import { useQueryClient } from '@tanstack/react-query'
import { useNavigate, useRouterState } from '@tanstack/react-router'
import { useEffect } from 'react'
import { RouteError } from '../../components/RouteError'
import { requestQueryOptions, useRequest, useRequestPayloads } from '../../lib/queries'
import { RequestDetailContent } from './RequestDetailContent'
import { RequestDetailPending } from './RequestDetailPending'
import { requestPayloadState } from './requestPayloadState'
import { useRequestSwipe } from './useRequestSwipe'

type Props = {
  id: string
}

export function RequestDetailPage({ id }: Props) {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const isNavigating = useRouterState({
    select: (state) => state.isLoading && state.location.pathname !== state.resolvedLocation?.pathname,
  })
  const { data, error, isFetching, isPlaceholderData } = useRequest(id)
  const payloads = useRequestPayloads(id)
  const req = data?.request
  const prevId = data?.prevId ?? null
  const nextId = data?.nextId ?? null
  const swipe = useRequestSwipe((direction) => {
    const target = direction === 'newer' ? prevId : nextId
    if (target) void navigate({ to: '/requests/$id', params: { id: target } })
  }, !isPlaceholderData && !isNavigating)

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

  if (!req) return <RequestDetailPending />

  return (
    <div className="content" {...swipe}>
      <div className="page min-h-full">
        <RequestDetailContent
          req={req}
          prevId={prevId}
          nextId={nextId}
          payloads={requestPayloadState(payloads.data, payloads.error, isPlaceholderData)}
          isMetadataLoading={isPlaceholderData}
          onRetryPayloads={() => {
            void payloads.refetch()
          }}
        />
        {isFetching && !isPlaceholderData ? (
          <div className="mx-6 mt-3 font-mono text-[11px] text-fg-dim max-md:mx-3">refreshing request detail…</div>
        ) : null}
      </div>
    </div>
  )
}
