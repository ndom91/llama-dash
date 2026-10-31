import { PageHeaderSkeleton, SkeletonBlock } from './skeleton/SkeletonFrame'

export function NavigationPending() {
  return (
    <div className="content" role="status" aria-label="Loading page">
      <span className="sr-only">Loading page…</span>
      <div className="page min-h-full" aria-hidden="true">
        <PageHeaderSkeleton />
        <div className="flex min-h-0 flex-1 flex-col gap-4 pt-3">
          <div className="grid grid-cols-3 gap-4 max-md:grid-cols-1">
            {[1, 2, 3].map((key) => (
              <SkeletonBlock key={key} className="h-24 rounded" />
            ))}
          </div>
          <SkeletonBlock className="min-h-64 flex-1 rounded" />
        </div>
      </div>
    </div>
  )
}
