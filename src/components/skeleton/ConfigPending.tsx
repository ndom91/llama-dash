import { PageHeaderSkeleton, SkeletonPageFrame } from './SkeletonFrame'

const EDITOR_ROWS = Array.from({ length: 20 }, (_, index) => `pending-editor-${index}`)

export function ConfigPending() {
  return (
    <SkeletonPageFrame>
      <PageHeaderSkeleton kickerWidth={112} titleWidth={190} />
      <div className="panel flex min-h-0 flex-1 flex-col overflow-hidden !rounded-none !border-x-0 !bg-surface-1 border-border-strong">
        <div className="flex items-center gap-2 border-b border-border bg-surface-3 px-3.5 py-2 font-mono text-[11px] text-fg-dim">
          <span className="skel skel-text" style={{ width: 96 }} />
          <span className="ml-auto skel skel-text" style={{ width: 120 }} />
        </div>
        <div className="min-h-0 flex-1 overflow-hidden bg-surface-0 p-4 font-mono text-xs max-md:p-3">
          {EDITOR_ROWS.map((row, index) => (
            <div key={row} className="mb-3 grid grid-cols-[36px_minmax(0,1fr)] gap-4">
              <span className="skel skel-text" style={{ width: 22 }} />
              <span className="skel skel-text" style={{ width: `${34 + (index % 7) * 8}%` }} />
            </div>
          ))}
        </div>
        <div className="border-t border-border bg-surface-3 px-3.5 py-2">
          <span className="skel skel-text" style={{ width: 360, maxWidth: '80%' }} />
        </div>
      </div>
    </SkeletonPageFrame>
  )
}
