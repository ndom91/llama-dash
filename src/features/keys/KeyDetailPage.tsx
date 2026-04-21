import { TopBar } from '../../components/TopBar'
import { useKeyDetail } from '../../lib/queries'
import { KeyDetailContent } from './KeyDetailContent'
import { KeyDetailSkeleton } from './KeyDetailSkeleton'

type Props = {
  id: string
}

export function KeyDetailPage({ id }: Props) {
  const { data, error } = useKeyDetail(id)

  return (
    <div className="main-col">
      <TopBar />
      <div className="content">
        <div className="page detail-page detail-page-sidecar min-h-full">
          {error ? (
            <div className="err-banner mx-6 mt-3 max-md:mx-3">{error.message}</div>
          ) : data == null ? (
            <KeyDetailSkeleton />
          ) : (
            <KeyDetailContent data={data} />
          )}
        </div>
      </div>
    </div>
  )
}
