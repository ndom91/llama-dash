import { TopBar } from '../../components/TopBar'
import { useModelDetail } from '../../lib/queries'
import { ModelDetailContent } from './ModelDetailContent'

type Props = {
  id: string
}

export function ModelDetailPage({ id }: Props) {
  const { data, error } = useModelDetail(id)

  return (
    <div className="main-col">
      <TopBar />
      <div className="content">
        <div className="page detail-page detail-page-sidecar min-h-full">
          {error ? (
            <div className="err-banner mx-6 mt-3 max-md:mx-3">{error.message}</div>
          ) : data == null ? (
            <div className="empty-state">loading…</div>
          ) : (
            <ModelDetailContent data={data} />
          )}
        </div>
      </div>
    </div>
  )
}
