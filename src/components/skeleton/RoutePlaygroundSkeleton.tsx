import type { ReactNode } from 'react'
import { PageHeaderSkeleton, SkeletonBlock, SkeletonLine, SkeletonPageFrame } from './SkeletonFrame'

const CHAT_ROWS = Array.from({ length: 6 }, (_, index) => `pending-chat-${index}`)
const SAMPLING_ROWS = ['temperature', 'top_p', 'top_k', 'max_tokens', 'frequency', 'presence']
const OUTPUT_ROWS = ['seed', 'n', 'stream', 'logprobs']

export function RoutePlaygroundSkeleton() {
  return (
    <SkeletonPageFrame>
      <PageHeaderSkeleton kickerWidth={156} titleWidth={170} />
      <div className="flex gap-2 border-b border-border bg-surface-0 px-6 py-3 max-md:px-3">
        {['Chat', 'Image', 'Speech', 'Transcribe'].map((tab, index) => (
          <div key={tab} className="rounded border border-border bg-surface-1 px-3 py-2">
            <SkeletonLine width={index === 3 ? 80 : 46} />
          </div>
        ))}
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-[280px_minmax(0,1fr)_320px] bg-surface-1 max-[1100px]:grid-cols-[260px_minmax(0,1fr)] max-[1100px]:[&>.pg-inspector-skeleton]:hidden max-[900px]:grid-cols-1 max-[900px]:[&>.pg-session-skeleton]:hidden">
        <aside className="pg-session-skeleton flex min-h-0 flex-col gap-2 overflow-hidden border-r border-border bg-surface-1 px-4 pt-3.5 pb-5 shadow-[inset_-1px_0_0_rgba(255,255,255,0.02)]">
          <SkeletonSessionSection labelWidth={62}>
            <SkeletonLine width="100%" height={32} className="rounded-sm" />
          </SkeletonSessionSection>

          <SkeletonSessionSection labelWidth={44}>
            <SkeletonLine width="100%" height={32} className="rounded-sm" />
          </SkeletonSessionSection>

          <SkeletonSessionSection labelWidth={96}>
            <SkeletonBlock className="h-[86px] rounded-sm" />
          </SkeletonSessionSection>

          <SkeletonSessionSection labelWidth={72} action>
            <div className="space-y-3">
              {SAMPLING_ROWS.map((row, index) => (
                <div key={row} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-3">
                    <SkeletonLine width={index === 3 ? 72 : 58} height={9} />
                    <SkeletonLine width={34} height={9} />
                  </div>
                  <SkeletonLine width="100%" height={4} className="rounded-full" />
                </div>
              ))}
            </div>
          </SkeletonSessionSection>

          <SkeletonSessionSection labelWidth={92}>
            <div className="space-y-3">
              {OUTPUT_ROWS.map((row, index) => (
                <div key={row} className="flex items-center justify-between gap-4">
                  <SkeletonLine width={index === 1 ? 70 : 48} height={9} />
                  <SkeletonLine width={index < 2 ? 76 : 38} height={24} className="rounded-sm" />
                </div>
              ))}
            </div>
          </SkeletonSessionSection>
        </aside>

        <div className="flex min-h-0 flex-col border-r border-border max-[1200px]:border-r-0">
          <div className="flex-1 space-y-4 overflow-hidden p-6 max-md:p-3">
            {CHAT_ROWS.map((row, index) => (
              <div key={row} className={index % 2 === 0 ? 'mr-16' : 'ml-16'}>
                <div className="panel p-4">
                  <SkeletonLine width={index % 2 === 0 ? '68%' : '44%'} />
                  <div className="mt-3 space-y-2">
                    <SkeletonLine width="92%" className="block" />
                    <SkeletonLine width={`${54 + (index % 3) * 12}%`} className="block" />
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="border-t border-border bg-surface-0 p-4 max-md:p-3">
            <SkeletonBlock className="h-24 rounded" />
          </div>
        </div>
        <aside className="pg-inspector-skeleton flex min-h-0 flex-col bg-surface-0 p-4">
          <SkeletonLine width={110} />
          <SkeletonBlock className="mt-4 h-48 rounded" />
          <div className="mt-4 grid grid-cols-2 gap-3">
            <SkeletonLine width="100%" height={36} />
            <SkeletonLine width="100%" height={36} />
            <SkeletonLine width="100%" height={36} />
            <SkeletonLine width="100%" height={36} />
          </div>
        </aside>
      </div>
    </SkeletonPageFrame>
  )
}

function SkeletonSessionSection({
  children,
  labelWidth,
  action = false,
}: {
  children: ReactNode
  labelWidth: number
  action?: boolean
}) {
  return (
    <section className="border-b border-dashed border-border py-3 last:border-b-0">
      <div className="mb-2 flex items-center justify-between gap-2">
        <SkeletonLine width={labelWidth} height={9} />
        {action ? <SkeletonLine width={20} height={20} className="rounded-sm" /> : null}
      </div>
      {children}
    </section>
  )
}
