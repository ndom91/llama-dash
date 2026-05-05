import { PageHeaderSkeleton, SkeletonPageFrame } from './SkeletonFrame'

const CHAT_ROWS = Array.from({ length: 6 }, (_, index) => `pending-chat-${index}`)

export function PlaygroundPending() {
  return (
    <SkeletonPageFrame>
      <PageHeaderSkeleton kickerWidth={156} titleWidth={170} />
      <div className="flex gap-2 border-b border-border bg-surface-0 px-6 py-3 max-md:px-3">
        {['Chat', 'Image', 'Speech', 'Transcribe'].map((tab, index) => (
          <div key={tab} className="rounded border border-border bg-surface-1 px-3 py-2">
            <span className="skel skel-text" style={{ width: index === 3 ? 80 : 46 }} />
          </div>
        ))}
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_320px] bg-surface-1 max-xl:grid-cols-1">
        <div className="flex min-h-0 flex-col border-r border-border max-xl:border-r-0">
          <div className="flex-1 space-y-4 overflow-hidden p-6 max-md:p-3">
            {CHAT_ROWS.map((row, index) => (
              <div key={row} className={index % 2 === 0 ? 'mr-16' : 'ml-16'}>
                <div className="panel p-4">
                  <span className="skel skel-text" style={{ width: index % 2 === 0 ? '68%' : '44%' }} />
                  <div className="mt-3 space-y-2">
                    <span className="skel skel-text block" style={{ width: '92%' }} />
                    <span className="skel skel-text block" style={{ width: `${54 + (index % 3) * 12}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="border-t border-border bg-surface-0 p-4 max-md:p-3">
            <span className="skel skel-block h-24 rounded" />
          </div>
        </div>
        <aside className="hidden min-h-0 flex-col bg-surface-0 p-4 xl:flex">
          <span className="skel skel-text" style={{ width: 110 }} />
          <span className="skel skel-block mt-4 h-48 rounded" />
          <div className="mt-4 grid grid-cols-2 gap-3">
            <span className="skel skel-text" style={{ height: 36 }} />
            <span className="skel skel-text" style={{ height: 36 }} />
            <span className="skel skel-text" style={{ height: 36 }} />
            <span className="skel skel-text" style={{ height: 36 }} />
          </div>
        </aside>
      </div>
    </SkeletonPageFrame>
  )
}
