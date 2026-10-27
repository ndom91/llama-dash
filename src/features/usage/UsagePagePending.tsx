import { PageHeaderSkeleton } from '../../components/skeleton/SkeletonFrame'
import { UsageContentSkeleton, UsageTotalsSkeleton } from './UsageContentSkeleton'

export function UsagePagePending() {
  return (
    <div className="content overflow-hidden">
      <div className="page h-full min-h-0 px-0">
        <div className="shrink-0" aria-hidden="true">
          <PageHeaderSkeleton kickerWidth={80} titleWidth={100} />
        </div>
        <div aria-hidden="true">
          <UsageTotalsSkeleton />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <UsageContentSkeleton />
        </div>
      </div>
    </div>
  )
}
