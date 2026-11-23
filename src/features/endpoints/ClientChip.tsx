import { Tooltip } from '../../components/Tooltip'
import { cn } from '../../lib/cn'

type Props = {
  label: string
  icon: string
  selected: boolean
  available: boolean
  /** Type labels this client has examples for, shown when it is unavailable. */
  supportedTypes: ReadonlyArray<string>
  onSelect: () => void
}

export function ClientChip({ label, icon, selected, available, supportedTypes, onSelect }: Props) {
  const chip = (
    <button
      type="button"
      aria-pressed={selected}
      disabled={!available}
      onClick={onSelect}
      className={cn(
        'inline-flex h-7 items-center gap-1.5 rounded-sm border px-2.5 font-mono text-xs transition-[background-color,border-color,color] duration-100 ease-out focus-visible:outline-none focus-visible:shadow-focus',
        selected && 'border-border-strong bg-surface-3 text-fg',
        !selected && available && 'cursor-pointer border-border text-fg-muted hover:bg-surface-2 hover:text-fg',
        !available && 'pointer-events-none border-dashed border-border text-fg-faint',
      )}
    >
      <span aria-hidden className="text-[10px] text-fg-dim">
        {icon}
      </span>
      {label}
    </button>
  )

  if (available) return chip

  // Disabled buttons swallow pointer events, so the tooltip hangs off a wrapper.
  return (
    <Tooltip label={`${label} supports ${supportedTypes.join(', ')}`}>
      <span className="inline-flex cursor-not-allowed">{chip}</span>
    </Tooltip>
  )
}
