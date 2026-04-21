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
        <div className="page min-h-full bg-surface-0">
          {error ? (
            <div className="err-banner mx-6 mt-3 max-md:mx-3">{error.message}</div>
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
