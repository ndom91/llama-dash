import { Link } from '@tanstack/react-router'
import { Sparkline } from '../../components/Sparkline'
import type { ApiUsageWindow, UsagePeriodDays } from '../../lib/api'
import { UsageDelta } from '../usage/UsageDelta'
import { formatTokens } from '../usage/usageUtils'

type Props = {
  label: string
  window: ApiUsageWindow | undefined
  against: string
  /** Usage page period this card opens. */
  days: UsagePeriodDays
}

export function DashboardUsageCard({ label, window, against, days }: Props) {
  return (
    <Link
      to="/usage"
      search={{ days }}
      className="card flex min-h-30 flex-col gap-2 p-4 no-underline transition-[background-color] duration-120 hover:bg-surface-2 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
      aria-label={`${label}: open usage for ${days === 1 ? 'the last 24 hours' : `the last ${days} days`}`}
    >
      <div className="stat-card-label">{label}</div>
      <div className="stat-card-row flex-wrap">
        <span className="stat-card-value">{window ? formatTokens(window.completionTokens) : '—'}</span>
        <span className="stat-card-unit">tokens</span>
        {window?.comparisonIncomplete ? (
          <span className="ml-auto font-mono text-[11px] text-fg-dim">history incomplete</span>
        ) : window ? (
          <UsageDelta
            className="ml-auto"
            current={window.completionTokens}
            previous={window.previous}
            against={against}
          />
        ) : null}
      </div>
      {window ? (
        <div className="mt-auto opacity-90">
          <Sparkline data={window.series} height={32} />
        </div>
      ) : null}
    </Link>
  )
}
