import { PageHeaderSkeleton, SkeletonLine, SkeletonPageFrame } from './SkeletonFrame'

const LOG_ROWS = Array.from({ length: 18 }, (_, index) => `pending-log-${index}`)

export function RouteLogsSkeleton() {
  return (
    <SkeletonPageFrame>
      <PageHeaderSkeleton kickerWidth={104} titleWidth={90} />
      <div className="workspace flex min-h-0 flex-col">
        <div className="flex min-h-12 shrink-0 items-center justify-between border-b border-border bg-surface-1 px-4 max-md:flex-wrap max-md:px-3">
          <div className="flex h-12 items-stretch border-x border-border">
            <SkeletonLine width={34} height="100%" className="!rounded-none" />
            <SkeletonLine width={66} height="100%" className="!rounded-none border-l border-border" />
            <SkeletonLine width={48} height="100%" className="!rounded-none border-l border-border" />
          </div>
          <div className="flex items-center gap-2 max-md:w-full max-md:pb-2">
            <SkeletonLine width={52} />
            <SkeletonLine width={64} height={28} className="rounded-sm" />
            <SkeletonLine width={180} height={28} className="rounded-sm" />
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-hidden bg-surface-1 px-3.5 font-mono text-xs max-md:px-3">
          {LOG_ROWS.map((row, index) => (
            <div key={row} className="flex items-start py-1.5">
              <SkeletonLine width={88} className="mr-3" />
              <SkeletonLine width={78} className="mr-3" />
              <SkeletonLine width={44} className="mr-3" />
              <SkeletonLine width={`${44 + (index % 6) * 8}%`} />
            </div>
          ))}
        </div>
      </div>
    </SkeletonPageFrame>
  )
}
