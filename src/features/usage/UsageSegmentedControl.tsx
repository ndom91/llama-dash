import { cn } from '../../lib/cn'

type Props<T extends string | number> = {
  legend: string
  options: ReadonlyArray<{ value: T; label: string }>
  value: T
  onChange: (value: T) => void
}

export function UsageSegmentedControl<T extends string | number>({ legend, options, value, onChange }: Props<T>) {
  return (
    <fieldset className="m-0 flex min-w-0 shrink-0 overflow-hidden rounded border border-border bg-surface-2 p-0.5">
      <legend className="sr-only">{legend}</legend>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={cn(
            'rounded-sm px-2.5 py-1 font-mono text-[11px] tabular-nums transition-[background-color,color] duration-100',
            value === option.value ? 'bg-accent text-accent-on' : 'text-fg-dim hover:bg-surface-1 hover:text-fg',
          )}
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </fieldset>
  )
}
