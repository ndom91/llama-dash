import { cn } from '../../lib/cn'

type Props<T extends string> = {
  value: T
  options: Array<{ value: T; label: string }>
  onChange: (v: T) => void
}

export function PlaygroundSegmented<T extends string>({ value, options, onChange }: Props<T>) {
  return (
    <span className="inline-flex overflow-hidden rounded-[3px] border border-border">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={cn(
            'bg-transparent px-2 py-0.5 font-mono text-[11px] text-fg-dim',
            value === option.value && 'bg-surface-3 text-fg',
          )}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </span>
  )
}
