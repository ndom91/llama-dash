import { PageHeaderSkeleton, SkeletonBlock, SkeletonLine, SkeletonPageFrame } from './SkeletonFrame'

const TABLE_ROWS = Array.from({ length: 11 }, (_, index) => `pending-row-${index}`)

export function RouteRequestsSkeleton() {
  return (
    <SkeletonPageFrame>
      <PageHeaderSkeleton kickerWidth={104} titleWidth={142} />
      <div className="grid min-h-0 flex-1 grid-cols-[240px_minmax(0,1fr)] items-stretch max-[900px]:grid-cols-1">
        <aside className="h-full border-border bg-surface-1 px-4 py-4 font-mono text-[11px] text-fg max-[900px]:border-b">
          {['Search', 'Status', 'Model', 'Key', 'Routing'].map((label) => (
            <div key={label} className="mb-4 flex flex-col gap-1.5">
              <div className="text-[10px] uppercase tracking-[0.12em] text-fg-dim">{label}</div>
              <SkeletonLine width="100%" height={32} />
            </div>
          ))}
        </aside>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col border-l border-border bg-surface-0 max-[900px]:border-l-0">
          <section className="panel !rounded-none !border-x-0 !border-t-0 !bg-surface-1">
            <div className="panel-head bg-transparent px-4">
              <span className="panel-title">req/s</span>
              <span className="panel-sub">last 60m</span>
            </div>
            <div className="px-4 pb-4">
              <SkeletonBlock className="h-28 rounded-sm" />
            </div>
          </section>

          <section className="panel !rounded-none !border-x-0 !border-t-0 !bg-surface-1 flex min-h-0 flex-1 flex-col">
            <div className="panel-head bg-transparent px-4">
              <span className="panel-title">Log</span>
              <span className="panel-sub">loading rows</span>
              <span className="ml-auto hidden font-mono text-[11px] text-fg-dim md:inline">↑↓ navigate · / search</span>
            </div>
            <table className="dtable dtable-virtual">
              <thead>
                <tr>
                  <th className="mono">t</th>
                  <th className="mono">endpoint</th>
                  <th>model</th>
                  <th>status</th>
                  <th className="num">tok-in</th>
                  <th className="num">tok-out</th>
                  <th className="num">duration</th>
                </tr>
              </thead>
              <tbody>
                {TABLE_ROWS.map((row, index) => (
                  <tr key={row}>
                    <td className="mono dim">
                      <SkeletonLine width={54} />
                    </td>
                    <td className="mono">
                      <SkeletonLine width={`${58 + (index % 4) * 8}%`} />
                    </td>
                    <td>
                      <SkeletonLine width={`${42 + (index % 3) * 12}%`} />
                    </td>
                    <td>
                      <SkeletonLine width={44} />
                    </td>
                    <td className="num">
                      <SkeletonLine width={32} />
                    </td>
                    <td className="num">
                      <SkeletonLine width={32} />
                    </td>
                    <td>
                      <div className="h-3 rounded-full bg-surface-2">
                        <SkeletonBlock width={`${44 + (index % 4) * 11}%`} className="h-full rounded-full" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      </div>
    </SkeletonPageFrame>
  )
}
