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
      className={cn('pg-toggle', value ? 'pg-toggle-on' : 'pg-toggle-off')}
      onClick={() => onChange(!value)}
    >
      {value ? labels[1] : labels[0]}
    </button>
  )
}
