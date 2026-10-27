import type { ApiUsageReport } from '../../lib/api'
import { UsageDelta } from './UsageDelta'
import { formatTokens } from './usageUtils'

type Props = {
  report: ApiUsageReport
}

export function UsageTotalsRow({ report }: Props) {
  const { totals, previous, days } = report
  const against = `vs prev ${days}d`
  const cards = [
    {
      label: 'generated',
      value: formatTokens(totals.completionTokens),
      unit: 'tokens',
      current: totals.completionTokens,
      prev: previous.completionTokens,
    },
    {
      label: 'prompt',
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
    <div className="dashboard-stats-row grid grid-cols-4 gap-0 border-b border-border max-[1100px]:grid-cols-2">
      {cards.map((card) => (
        <div
          key={card.label}
          className="stat-card min-h-[68px] max-[1100px]:[&:nth-child(2)]:border-r-0 max-[1100px]:[&:nth-child(-n+2)]:border-b max-[1100px]:[&:nth-child(-n+2)]:border-border"
        >
          <div className="stat-card-label">{card.label}</div>
          <div className="stat-card-row flex-wrap">
            <span className="stat-card-value">{card.value}</span>
            <span className="stat-card-unit">{card.unit}</span>
          </div>
          <UsageDelta current={card.current} previous={card.prev} against={against} />
        </div>
      ))}
    </div>
  )
}
