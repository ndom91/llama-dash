import { SkeletonBlock, SkeletonLine } from '../../components/skeleton/SkeletonFrame'
import { usageTotalsCardClass, usageTotalsRowClass } from './usageTotalsStyles'

const BARS = [30, 54, 40, 66, 43, 78, 52]
const ROWS = ['first', 'second', 'third']

export function UsageTotalsSkeleton() {
  return (
    <div className={usageTotalsRowClass} aria-hidden="true">
      {['output', 'input', 'requests', 'amount'].map((label) => (
        <div key={label} className={usageTotalsCardClass}>
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
      <div aria-hidden="true" className="flex min-w-0 flex-col gap-3">
        <div className="card">
          <div className="panel-head">
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
        <div className="card flex items-center px-4 py-2.5">
          <span className="panel-title">Breakdowns</span>
        </div>
        <div className="grid grid-cols-2 gap-3 max-[1100px]:grid-cols-1">
          {['first', 'second', 'third'].map((panel, index) => (
            <div key={panel} className={index === 2 ? 'card col-span-2 max-[1100px]:col-span-1' : 'card min-w-0'}>
              <div className="panel-head">
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
