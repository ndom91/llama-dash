import { RequestDetailSkeleton } from './RequestDetailSkeleton'

export function RequestDetailPending() {
  return (
    <div className="content" role="status" aria-label="Loading request detail">
      <span className="sr-only">Loading request detail…</span>
      <div className="page min-h-full" aria-hidden="true">
        <RequestDetailSkeleton />
      </div>
    </div>
  )
}
