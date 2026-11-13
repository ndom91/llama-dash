import { SkeletonLine } from '../../components/skeleton/SkeletonFrame'

export function SessionPagePending() {
  return (
    <div className="content md:overflow-hidden" role="status" aria-label="Loading session history">
      <span className="sr-only">Loading session history…</span>
      <div className="page min-h-full min-w-0 md:h-full md:min-h-0" aria-hidden="true">
        <div className="page-header page-header-default hidden shrink-0 items-start justify-between gap-4 md:flex">
          <div className="page-header-copy flex min-w-0 flex-1 flex-col gap-1">
            <SkeletonLine width={150} height={10} className="max-w-full" />
            <SkeletonLine width={250} height={24} className="mt-0.5 max-w-full" />
            <SkeletonLine width={320} height={12} className="max-w-full" />
          </div>
          <div className="flex shrink-0 gap-2">
            {[1, 2, 3, 4].map((item) => (
              <SkeletonLine key={item} width={80} height={28} />
            ))}
          </div>
        </div>
        <div className="border-b border-border px-3.5 py-3 md:hidden">
          <SkeletonLine width={78} height={10} className="my-3" />
          <SkeletonLine width="75%" height={22} className="mt-2 max-w-full" />
          <SkeletonLine width="90%" height={12} className="mt-3 max-w-full" />
        </div>
        <div className="flex items-center justify-between gap-2 border-b border-border px-3.5 py-2 md:hidden">
          <SkeletonLine width="55%" height={10} />
          <div className="flex gap-1">
            <SkeletonLine width={42} height={36} />
            <SkeletonLine width={62} height={36} />
          </div>
        </div>
        <div className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_300px] max-lg:grid-cols-1 md:min-h-0 md:grid-rows-[auto_minmax(0,1fr)] lg:grid-rows-1">
          <main className="min-w-0 md:min-h-0 md:overflow-hidden">
            <div className="session-split-heading hidden md:grid">
              <span>
                <SkeletonLine width={65} height={9} />
              </span>
              <span>
                <SkeletonLine width={90} height={9} />
              </span>
            </div>
            <SessionExchangeSkeleton />
            <SessionExchangeSkeleton />
            <SessionExchangeSkeleton />
          </main>
          <aside className="space-y-4 border-l border-border bg-surface-0 p-4 max-lg:hidden">
            <SkeletonLine width={70} height={10} />
            {['client', 'model', 'requests', 'tokens', 'cache', 'input', 'cost'].map((item) => (
              <div key={item} className="flex justify-between gap-3 border-b border-dashed border-border py-2">
                <SkeletonLine width={70} height={10} />
                <SkeletonLine width={100} height={10} />
              </div>
            ))}
            <SkeletonLine width={90} height={10} />
            {['one', 'two', 'three', 'four', 'five'].map((item) => (
              <SkeletonLine key={item} width="100%" height={8} />
            ))}
          </aside>
          <div className="hidden border-b border-border bg-surface-0 px-4 py-3 max-lg:md:order-first max-lg:md:block">
            <SkeletonLine width={170} height={12} />
          </div>
        </div>
      </div>
    </div>
  )
}

export function SessionExchangeSkeleton() {
  return (
    <div aria-hidden="true">
      <div className="session-split-row hidden md:grid">
        <div className="session-split-meta flex flex-col items-start gap-2">
          <SkeletonLine width={32} height={14} />
          <SkeletonLine width={58} height={14} />
          <SkeletonLine width={65} height={10} />
          <SkeletonLine width={75} height={5} />
          <SkeletonLine width={55} height={10} />
        </div>
        <div className="session-conversation flex min-w-0 flex-col gap-2">
          {['sent', 'thinking', 'assistant', 'tool'].map((kind) => (
            <div key={kind} className="session-entry">
              <SkeletonLine width={20} height={20} />
              <div className="min-w-0 space-y-2">
                <SkeletonLine width={kind === 'tool' ? '60%' : 120} height={10} />
                {kind === 'assistant' ? (
                  <div className="space-y-2 border-l border-border-strong pl-3.5">
                    <SkeletonLine width="72%" height={12} />
                    <SkeletonLine width="55%" height={12} />
                  </div>
                ) : null}
              </div>
            </div>
          ))}
          <SkeletonLine width={65} height={18} className="ml-auto" />
        </div>
      </div>
      <div className="space-y-4 px-3.5 py-4 md:hidden">
        <div className="flex items-center gap-2">
          <span className="h-px flex-1 bg-border" />
          <SkeletonLine width={160} height={12} />
          <span className="h-px flex-1 bg-border" />
        </div>
        <SkeletonLine width={95} height={10} />
        <div className="space-y-2 border-l border-border pl-4">
          <SkeletonLine width="95%" height={12} />
          <SkeletonLine width="70%" height={12} />
        </div>
        <SkeletonLine width="100%" height={36} />
      </div>
    </div>
  )
}
