import { TopBar } from '../../components/TopBar'
import { useKeyDetail } from '../../lib/queries'
import { KeyDetailContent } from './KeyDetailContent'

type Props = {
  id: string
}

export function KeyDetailPage({ id }: Props) {
  const { data, error } = useKeyDetail(id)

  return (
    <div className="main-col">
      <TopBar />
      <div className="content">
        <div className="page min-h-full bg-surface-0">
          {error ? (
            <div className="err-banner mx-6 mt-3 max-md:mx-3">{error.message}</div>
          ) : data == null ? (
            <div className="empty-state">loading…</div>
          ) : (
            <KeyDetailContent data={data} />
          )}
        </div>
      </div>
    </div>
  )
}
