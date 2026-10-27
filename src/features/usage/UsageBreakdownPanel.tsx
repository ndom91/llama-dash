import { useNavigate } from '@tanstack/react-router'
import { Tooltip } from '../../components/Tooltip'
import type { ApiUsageBreakdownRow, ApiUsagePanel } from '../../lib/api'
import { clickableRowFocusClass, clickableRowProps } from '../../lib/clickable-row-props'
import { cn } from '../../lib/cn'
import { UsagePanel } from './UsagePanel'
import { UsageShareBar } from './UsageShareBar'
import { USAGE_DIMENSION_META, usageRowLabel, usageRowRequestsSearch } from './usageDimensions'
import { formatTokens } from './usageUtils'

type Props = {
  panel: ApiUsagePanel
  retentionDays: number
}

export function UsageBreakdownPanel({ panel, retentionDays }: Props) {
  const navigate = useNavigate()
  const meta = USAGE_DIMENSION_META[panel.dimension]
  const allRows = panel.others ? [...panel.rows, panel.others] : panel.rows
  const total = allRows.reduce((acc, row) => acc + row.totalTokens, 0)
  const showSpeed = panel.dimension === 'model'

  const renderRow = (row: ApiUsageBreakdownRow, folded: boolean) => {
    const search = folded ? null : usageRowRequestsSearch(panel.dimension, row)
    const muted = folded || row.value == null || (panel.dimension === 'key' && row.label == null)
    return (
      <tr
        key={folded ? '\u0001others' : (row.value ?? '\u0000')}
        className={cn(search && 'clickable-row', search && clickableRowFocusClass)}
        {...(search ? clickableRowProps(() => navigate({ to: '/requests', search })) : {})}
      >
        <td className={cn('mono max-w-0 truncate', muted && 'text-fg-dim italic')} translate="no">
          {usageRowLabel(panel.dimension, row)}
        </td>
        <td>
          <UsageShareBar part={row.totalTokens} total={total} />
        </td>
        <td className="num">{formatTokens(row.totalTokens)}</td>
        <td className="num dim whitespace-nowrap max-[700px]:hidden">
          {row.requests.toLocaleString('en')}
          {row.errors > 0 ? <span className="text-fg-faint"> · {row.errors.toLocaleString('en')} err</span> : null}
        </td>
        {showSpeed ? (
          <td className="num">{row.avgGenTokPerSec != null ? row.avgGenTokPerSec.toFixed(1) : '—'}</td>
        ) : null}
      </tr>
    )
  }

  return (
    <UsagePanel
      title={`By ${meta.title}`}
      sub={`${panel.values.toLocaleString('en')} value${panel.values === 1 ? '' : 's'} · share of tokens`}
    >
      {panel.partial ? (
        <div className="border-b border-border px-4 py-2 font-mono text-[11px] text-fg-dim">
          last {retentionDays} days only: sessions are not kept after log retention
        </div>
      ) : null}
      {allRows.length === 0 ? (
        <div className="empty-state">No requests in this period.</div>
      ) : (
        <table className="dtable">
          <thead>
            <tr>
              <th className="w-[34%]">{meta.column}</th>
              <th className="w-[30%]">share</th>
              <th className="num">tokens</th>
              <th className="num max-[700px]:hidden">requests</th>
              {showSpeed ? (
                <th className="num">
                  <Tooltip label="Generated tokens per second of wall time, successful streamed requests only (includes prefill)">
                    <span className="cursor-help underline decoration-dotted underline-offset-2">tok/s</span>
                  </Tooltip>
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {panel.rows.map((row) => renderRow(row, false))}
            {panel.others ? renderRow(panel.others, true) : null}
          </tbody>
        </table>
      )}
    </UsagePanel>
  )
}
