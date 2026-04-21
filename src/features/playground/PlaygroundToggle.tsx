import { cn } from '../../lib/cn'

type Props = {
  value: boolean
  onChange: (v: boolean) => void
  labels: [string, string]
}

export function PlaygroundToggle({ value, onChange, labels }: Props) {
  return (
    <button
      type="button"
      className={cn(
        'rounded-[3px] border px-2 py-0.5 font-mono text-[11px] font-medium',
        value ? 'border-ok bg-ok-bg text-ok' : 'border-border bg-surface-2 text-fg-dim',
      )}
      onClick={() => onChange(!value)}
    >
      {value ? labels[1] : labels[0]}
    </button>
  )
}
