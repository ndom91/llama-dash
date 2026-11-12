import { SkeletonLine } from '../../components/skeleton/SkeletonFrame'

export function SessionPagePending() {
  return (
    <div className="content" role="status" aria-label="Loading session history">
      <span className="sr-only">Loading session history…</span>
      <div className="page min-h-full min-w-0" aria-hidden="true">
        <div className="page-header page-header-default flex shrink-0 items-start justify-between gap-4 max-sm:flex-wrap">
          <div className="page-header-copy flex min-w-0 flex-1 flex-col gap-1">
            <SkeletonLine width={150} height={10} className="max-w-full" />
            <SkeletonLine width={160} height={24} className="mt-0.5 max-w-full" />
            <SkeletonLine width={320} height={12} className="max-w-full" />
          </div>
          <div className="flex shrink-0 items-center max-sm:min-h-11 max-sm:w-full">
            <SkeletonLine width={112} height={12} />
          </div>
        </div>
        <div className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_300px] max-lg:grid-cols-1">
          <main className="mx-auto w-full min-w-0 max-w-[820px] space-y-5 px-6 py-6 max-md:px-3">
            <div className="flex items-center gap-2">
              <span className="h-px flex-1 bg-border" />
              <SkeletonLine width="65%" height={18} className="max-w-full rounded-full" />
              <span className="h-px flex-1 bg-border" />
            </div>
            <SessionExchangeSkeleton />
            <div className="flex items-center gap-2">
              <span className="h-px flex-1 bg-border" />
              <SkeletonLine width="45%" height={18} className="max-w-full rounded-full" />
              <span className="h-px flex-1 bg-border" />
            </div>
            <SessionExchangeSkeleton />
          </main>
          <aside className="space-y-4 border-l border-border bg-surface-0 p-4 max-lg:hidden">
            <SkeletonLine width={70} height={10} />
            {['client', 'model', 'requests', 'tokens', 'cache', 'cost'].map((item) => (
              <div key={item} className="flex justify-between gap-3 border-b border-dashed border-border py-2">
                <SkeletonLine width={70} height={10} />
                <SkeletonLine width={100} height={10} />
              </div>
            ))}
            <SkeletonLine width={90} height={10} />
            <SkeletonLine width="100%" height={50} />
          </aside>
        </div>
      </div>
    </div>
  )
}

export function SessionExchangeSkeleton() {
  return (
    <div className="min-w-0 rounded border border-border" aria-hidden="true">
      <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-border px-4 py-3 max-sm:px-3">
        <div className="flex min-h-0 max-w-full items-center max-sm:min-h-11">
          <SkeletonLine width={215} height={12} className="max-w-full" />
        </div>
        <SkeletonLine width={130} height={11} />
        <SkeletonLine width={95} height={11} />
        <SkeletonLine width={55} height={11} />
        <SkeletonLine width={45} height={11} />
      </div>
      <div className="space-y-5 px-4 py-4 max-sm:px-3">
        {['user', 'assistant'].map((role) => (
          <div key={role} className="grid grid-cols-[100px_minmax(0,1fr)] gap-3 max-sm:grid-cols-1 max-sm:gap-2">
            <SkeletonLine width={64} height={10} />
            <div className="flex min-w-0 flex-col gap-2">
              <SkeletonLine width="90%" height={12} />
              <SkeletonLine width={role === 'user' ? '58%' : '72%'} height={12} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
