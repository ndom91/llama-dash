import { cn } from '../../lib/cn'

type Props<T extends string> = {
  value: T
  options: Array<{ value: T; label: string }>
  onChange: (v: T) => void
}

export function PlaygroundSegmented<T extends string>({ value, options, onChange }: Props<T>) {
  return (
    <span className="pg-segmented">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={cn('pg-seg-btn', value === option.value && 'pg-seg-btn-active')}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </span>
  )
}
