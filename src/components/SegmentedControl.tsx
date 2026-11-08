import type { ReactNode } from 'react'
import { cn } from '../lib/cn'
import { useSlidingIndicator } from '../lib/use-sliding-indicator'

type Props<T extends string | number> = {
  legend: string
  options: ReadonlyArray<{ value: T; label: ReactNode }>
  value: T
  onChange: (value: T) => void
  variant?: 'accent' | 'theme' | 'routing' | 'strip'
  fullWidth?: boolean
}

export function SegmentedControl<T extends string | number>({
  legend,
  options,
  value,
  onChange,
  variant = 'accent',
  fullWidth = false,
}: Props<T>) {
  const optionKey = JSON.stringify(options.map((option) => option.value))
  const { containerRef, indicatorRef, itemRefs, ready } = useSlidingIndicator<T, HTMLFieldSetElement>(value, optionKey)

  return (
    <fieldset
      ref={containerRef}
      className={cn(
        't-tabs segmented-control m-0 flex min-w-0 shrink-0 overflow-hidden rounded border border-border bg-surface-2 p-0.5',
        `segmented-control--${variant}`,
        fullWidth && 'segmented-control--full-width',
      )}
    >
      <legend className="sr-only">{legend}</legend>
      <span ref={indicatorRef} className="t-tabs-pill segmented-control-pill" data-ready={ready} aria-hidden="true" />
      {options.map((option) => (
        <button
          key={option.value}
          ref={(element) => {
            if (element) itemRefs.current.set(option.value, element)
            else itemRefs.current.delete(option.value)
          }}
          type="button"
          className={cn(
            't-tab segmented-control-tab rounded-sm px-2.5 py-1 font-mono text-[11px] tabular-nums',
            value === option.value && !ready ? 'bg-accent text-accent-on' : '',
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
