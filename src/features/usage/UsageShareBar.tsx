import { formatShare } from './usageUtils'

type Props = {
  part: number
  total: number
}

export function UsageShareBar({ part, total }: Props) {
  const pct = total > 0 ? Math.min(100, (part / total) * 100) : 0
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 min-w-10 flex-1 overflow-hidden rounded-pill bg-surface-4" aria-hidden="true">
        <div className="h-full rounded-pill bg-accent" style={{ width: `${pct > 0 ? Math.max(pct, 1.5) : 0}%` }} />
      </div>
      <span className="w-9 shrink-0 text-right font-mono text-[11px] tabular-nums text-fg-muted">
        {formatShare(part, total)}
      </span>
    </div>
  )
}
