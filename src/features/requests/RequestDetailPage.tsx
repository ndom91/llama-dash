import { TopBar } from '../../components/TopBar'
import { useRequest } from '../../lib/queries'
import { RequestDetailContent } from './RequestDetailContent'
import { RequestDetailSkeleton } from './RequestDetailSkeleton'

type Props = {
  id: string
}

export function RequestDetailPage({ id }: Props) {
  const { data, error } = useRequest(id)
  const req = data?.request
  const prevId = data?.prevId ?? null
  const nextId = data?.nextId ?? null

  return (
    <div className="main-col">
      <TopBar />
      <div className="content">
        <div className="page detail-page detail-page-sidecar request-detail-page">
          {error ? (
            <div className="err-banner">{error.message}</div>
          ) : req == null ? (
            <RequestDetailSkeleton />
          ) : (
            <RequestDetailContent req={req} prevId={prevId} nextId={nextId} />
          )}
        </div>
      </div>
    </div>
  )
}
