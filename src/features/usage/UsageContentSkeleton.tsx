import { SkeletonBlock, SkeletonLine } from '../../components/skeleton/SkeletonFrame'

const BARS = [30, 54, 40, 66, 43, 78, 52]
const ROWS = ['first', 'second', 'third']

export function UsageTotalsSkeleton() {
  return (
    <div className="dashboard-stats-row grid grid-cols-4 gap-0 border-b border-border max-[1100px]:grid-cols-2">
      {['output', 'input', 'requests', 'amount'].map((label) => (
        <div
          key={label}
          className="stat-card min-h-[68px] max-[1100px]:[&:nth-child(2)]:border-r-0 max-[1100px]:[&:nth-child(-n+2)]:border-b max-[1100px]:[&:nth-child(-n+2)]:border-border"
        >
          <div className="stat-card-label">{label === 'amount' ? <SkeletonLine width={50} height={10} /> : label}</div>
          <div className="stat-card-row">
            <SkeletonLine width={76} height={25} />
          </div>
          <SkeletonLine width={94} height={10} />
        </div>
      ))}
    </div>
  )
}

export function UsageContentSkeleton() {
  return (
    <div role="status" aria-label="Loading usage">
      <span className="sr-only">Loading usage…</span>
      <div aria-hidden="true">
        <div className="border-b border-border">
          <div className="panel-head px-4">
            <span className="panel-title">Tokens per day</span>
          </div>
          <div className="px-4 pt-4 pb-6 pl-15">
            <div className="flex h-[168px] items-end gap-0.5 border-b border-border">
              {BARS.map((height) => (
                <SkeletonBlock key={height} className="min-w-0 flex-1 rounded-t-sm" height={`${height}%`} />
              ))}
            </div>
          </div>
        </div>
        <div className="flex h-9 items-center border-b border-border bg-surface-1 px-4">
          <span className="panel-title">Breakdowns</span>
        </div>
        <div className="grid grid-cols-2 max-[1100px]:grid-cols-1">
          {['first', 'second', 'third'].map((panel, index) => (
            <div
              key={panel}
              className={
                index === 2
                  ? 'col-span-2 border-t border-border max-[1100px]:col-span-1'
                  : index === 0
                    ? 'border-r border-border max-[1100px]:border-r-0'
                    : undefined
              }
            >
              <div className="panel-head px-4">
                <SkeletonLine width={100} height={10} />
              </div>
              {ROWS.map((row) => (
                <div key={row} className="flex h-9 items-center gap-4 border-b border-border px-4 last:border-b-0">
                  <SkeletonLine width="30%" />
                  <SkeletonLine width="25%" />
                  <SkeletonLine width={48} className="ml-auto" />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
