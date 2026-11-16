import { NumberField } from '@base-ui/react/number-field'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useId } from 'react'

type Props = { label: string; value: string; max: number; onChange: (value: string) => void }

export function TimeField({ label, value, max, onChange }: Props) {
  const id = useId()
  const stepButton =
    'flex h-4 w-6 cursor-pointer items-center justify-center text-fg-dim hover:bg-surface-3 hover:text-fg focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-default disabled:opacity-30'
  return (
    <NumberField.Root
      id={id}
      value={value === '' ? null : Number(value)}
      min={0}
      max={max}
      step={1}
      smallStep={1}
      format={{ minimumIntegerDigits: 2, maximumFractionDigits: 0, useGrouping: false }}
      onValueChange={(next) => onChange(next === null ? '' : String(next).padStart(2, '0'))}
    >
      <label htmlFor={id} className="mb-1 block text-[10px] text-fg-muted">
        {label}
      </label>
      <NumberField.Group className="flex overflow-hidden rounded border border-border-strong bg-surface-1 focus-within:border-accent">
        <NumberField.Input className="h-9 w-12 min-w-0 bg-transparent text-center text-sm tabular-nums text-fg outline-none" />
        <div className="flex flex-col justify-center border-l border-border">
          <NumberField.Increment aria-label={`Increase ${label.toLowerCase()}`} className={stepButton}>
            <ChevronUp size={12} aria-hidden="true" />
          </NumberField.Increment>
          <NumberField.Decrement aria-label={`Decrease ${label.toLowerCase()}`} className={stepButton}>
            <ChevronDown size={12} aria-hidden="true" />
          </NumberField.Decrement>
        </div>
      </NumberField.Group>
    </NumberField.Root>
  )
}
