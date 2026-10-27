import { ArrowDown, ArrowUp } from 'lucide-react'
import { cn } from '../../lib/cn'
import { usageDelta } from './usageUtils'

type Props = {
  current: number
  previous: number
  /** What the comparison is against, e.g. "vs prev 7d". */
  against: string
  className?: string
}

/**
 * Period-over-period change. Deliberately neutral ink: more or fewer tokens is
 * not a good or bad *state*, so it never borrows the status colours.
 */
export function UsageDelta({ current, previous, against, className }: Props) {
  const delta = usageDelta(current, previous)
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 font-mono text-[11px] tabular-nums text-fg-dim whitespace-nowrap',
        className,
      )}
    >
      {delta.kind === 'change' && delta.direction !== 'flat' ? (
        <span className="inline-flex items-center gap-0.5 text-fg-muted">
          {delta.direction === 'up' ? (
            <ArrowUp className="size-3" strokeWidth={2} aria-label="up" />
          ) : (
            <ArrowDown className="size-3" strokeWidth={2} aria-label="down" />
          )}
          {delta.percent}%
        </span>
      ) : (
        <span className="text-fg-muted">{delta.kind === 'new' ? 'new' : delta.kind === 'none' ? '—' : '±0%'}</span>
      )}
      <span>{against}</span>
    </span>
  )
}
