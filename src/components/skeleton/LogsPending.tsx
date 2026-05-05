import { PageHeaderSkeleton, SkeletonPageFrame } from './SkeletonFrame'

const LOG_ROWS = Array.from({ length: 18 }, (_, index) => `pending-log-${index}`)

export function LogsPending() {
  return (
    <SkeletonPageFrame>
      <PageHeaderSkeleton kickerWidth={104} titleWidth={90} />
      <div className="flex items-center gap-2 border-b border-border bg-surface-1 px-4 py-3 font-mono max-md:px-3">
        <span className="skel skel-text" style={{ width: 180, height: 32 }} />
        <span className="skel skel-text" style={{ width: 74, height: 32 }} />
        <span className="skel skel-text" style={{ width: 74, height: 32 }} />
        <span className="ml-auto skel skel-text max-sm:hidden" style={{ width: 120 }} />
      </div>
      <div className="min-h-0 flex-1 overflow-hidden bg-[#050607] p-4 font-mono text-xs max-md:p-3">
        {LOG_ROWS.map((row, index) => (
          <div key={row} className="mb-2 grid grid-cols-[90px_72px_minmax(0,1fr)] gap-3">
            <span className="skel skel-text" style={{ width: 72 }} />
            <span className="skel skel-text" style={{ width: index % 5 === 0 ? 54 : 36 }} />
            <span className="skel skel-text" style={{ width: `${44 + (index % 6) * 8}%` }} />
          </div>
        ))}
      </div>
    </SkeletonPageFrame>
  )
}
