import { cn } from '../../lib/cn'
import { useSkeletonReveal } from '../../lib/use-skeleton-reveal'
import { RouteError } from '../../components/RouteError'
import { useKeyDetail } from '../../lib/queries'
import { KeyDetailContent } from './KeyDetailContent'
import { KeyDetailSkeleton } from './KeyDetailSkeleton'

type Props = {
  id: string
}

export function KeyDetailPage({ id }: Props) {
  const { data, error } = useKeyDetail(id)
  const reveal = useSkeletonReveal(data == null)

  if (error) {
    return <RouteError kicker="dsh · keys" title="Failed to load API key" message={error.message} />
  }

  return (
    <div className="content">
      <div className={cn('page detail-page detail-page-sidecar min-h-full', reveal && 't-reveal')}>
        {data == null ? <KeyDetailSkeleton /> : <KeyDetailContent data={data} />}
      </div>
    </div>
  )
}
