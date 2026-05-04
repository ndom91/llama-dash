import { RouteError } from '../../components/RouteError'
import { useKeyDetail } from '../../lib/queries'
import { KeyDetailContent } from './KeyDetailContent'
import { KeyDetailSkeleton } from './KeyDetailSkeleton'

type Props = {
  id: string
}

export function KeyDetailPage({ id }: Props) {
  const { data, error } = useKeyDetail(id)

  if (error) {
    return <RouteError kicker="dsh · keys" title="Failed to load API key" message={error.message} />
  }

  return (
    <div className="content">
      <div className="page detail-page detail-page-sidecar min-h-full">
        {data == null ? <KeyDetailSkeleton /> : <KeyDetailContent data={data} />}
      </div>
    </div>
  )
}
