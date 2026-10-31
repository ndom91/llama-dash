import { PageHeaderSkeleton, SkeletonLine, SkeletonPageFrame } from './SkeletonFrame'

const EDITOR_ROWS = Array.from({ length: 20 }, (_, index) => `pending-editor-${index}`)

export function RouteConfigSkeleton() {
  return (
    <SkeletonPageFrame>
      <PageHeaderSkeleton kickerWidth={112} titleWidth={190} action="none" />
      <div className="card flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="grid min-h-0 flex-1 grid-cols-[44px_minmax(0,1fr)] overflow-hidden bg-surface-0 font-mono text-xs">
          <div className="border-r border-border bg-surface-3 px-2.5 pt-3">
            {EDITOR_ROWS.map((row) => (
              <SkeletonLine key={row} width={16} height={11} className="mb-2.5 block ml-auto" />
            ))}
          </div>
          <div className="p-3">
            {EDITOR_ROWS.map((row, index) => (
              <div key={row} className="mb-2.5">
                <SkeletonLine width={`${34 + (index % 7) * 8}%`} />
              </div>
            ))}
          </div>
        </div>
        <div className="border-t border-border bg-surface-3 px-3.5 py-2">
          <SkeletonLine width={360} className="max-w-[80%]" />
        </div>
      </div>
    </SkeletonPageFrame>
  )
}
