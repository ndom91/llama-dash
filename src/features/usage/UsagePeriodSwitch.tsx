import type { UsagePeriodDays } from '../../lib/api'
import { cn } from '../../lib/cn'
import { USAGE_PERIODS } from '../../lib/schemas/usage'

type Props = {
  value: UsagePeriodDays
  onChange: (days: UsagePeriodDays) => void
}

export function UsagePeriodSwitch({ value, onChange }: Props) {
  return (
    <fieldset className="m-0 flex min-w-0 overflow-hidden rounded border border-border bg-surface-2 p-0.5">
      <legend className="sr-only">Period</legend>
      {USAGE_PERIODS.map((days) => (
        <button
          key={days}
          type="button"
          className={cn(
            'rounded-sm px-2.5 py-1 font-mono text-[11px] tabular-nums transition-[background-color,color] duration-100',
            value === days ? 'bg-accent text-accent-on' : 'text-fg-dim hover:bg-surface-1 hover:text-fg',
          )}
          aria-pressed={value === days}
          onClick={() => onChange(days)}
        >
          {days}d
        </button>
      ))}
    </fieldset>
  )
}
