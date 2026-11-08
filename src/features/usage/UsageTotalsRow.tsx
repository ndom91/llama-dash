import type { ApiUsageReport } from '../../lib/api'
import { UsageDelta } from './UsageDelta'
import { usageTotalsCardClass, usageTotalsRowClass } from './usageTotalsStyles'
import { formatTokens } from './usageUtils'

type Props = {
  report: ApiUsageReport
}

export function UsageTotalsRow({ report }: Props) {
  const { totals, previous, days } = report
  const against = `vs prev ${days}d`
  const cards = [
    {
      label: 'output',
      value: formatTokens(totals.completionTokens),
      unit: 'tokens',
      current: totals.completionTokens,
      prev: previous.completionTokens,
    },
    {
      label: 'input',
      value: formatTokens(totals.promptTokens),
      unit: 'tokens',
      current: totals.promptTokens,
      prev: previous.promptTokens,
    },
    {
      label: 'requests',
      value: formatTokens(totals.requests),
      unit: totals.errors > 0 ? `${formatTokens(totals.errors)} err` : 'calls',
      current: totals.requests,
      prev: previous.requests,
    },
    totals.costUsd != null
      ? {
          label: 'est. cost',
          value: `$${totals.costUsd.toFixed(2)}`,
          unit: 'usd',
          current: totals.costUsd,
          prev: previous.costUsd ?? 0,
        }
      : {
          label: 'total',
          value: formatTokens(totals.totalTokens),
          unit: 'tokens',
          current: totals.totalTokens,
          prev: previous.totalTokens,
        },
  ]

  return (
    <div className={usageTotalsRowClass}>
      {cards.map((card) => (
        <div key={card.label} className={`${usageTotalsCardClass} relative`}>
          <div className="stat-card-label min-[769px]:pr-[145px]">{card.label}</div>
          <div className="stat-card-row flex-wrap">
            <span className="stat-card-value">{card.value}</span>
            <span className="stat-card-unit">{card.unit}</span>
          </div>
          {report.comparisonIncomplete ? (
            <span className="font-mono text-[11px] text-fg-dim min-[769px]:absolute min-[769px]:top-3.5 min-[769px]:right-4">
              history incomplete
            </span>
          ) : (
            <UsageDelta
              className="min-[769px]:absolute min-[769px]:top-3.5 min-[769px]:right-4"
              current={card.current}
              previous={card.prev}
              against={against}
            />
          )}
        </div>
      ))}
    </div>
  )
}
