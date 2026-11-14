import { cn } from '../../lib/cn'
import { useSkeletonReveal } from '../../lib/use-skeleton-reveal'
import { RouteError } from '../../components/RouteError'
import { useModelDetail } from '../../lib/queries'
import { ModelDetailContent } from './ModelDetailContent'
import { ModelDetailSkeleton } from './ModelDetailSkeleton'

type Props = {
  id: string
}

export function ModelDetailPage({ id }: Props) {
  const { data, error } = useModelDetail(id)
  const reveal = useSkeletonReveal(data == null)

  if (error) {
    return <RouteError kicker="dsh · models" title="Failed to load model" message={error.message} />
  }

  return (
    <div className="content">
      <div className={cn('page detail-page detail-page-sidecar min-h-full', reveal && 't-reveal')}>
        {data == null ? <ModelDetailSkeleton /> : <ModelDetailContent data={data} />}
      </div>
    </div>
  )
}
