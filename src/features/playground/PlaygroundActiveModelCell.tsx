import { cn } from '../../lib/cn'

type Props = {
  label: string
  value: string | number
  unit?: string
  sub?: string
  mono?: boolean
}

export function PlaygroundActiveModelCell({ label, value, unit, sub, mono }: Props) {
  return (
    <div className="rounded border border-border bg-surface-2 px-2.5 py-2">
      <div className="mb-1 font-mono text-[10px] font-semibold uppercase tracking-[0.06em] text-fg-faint">{label}</div>
      <div className={cn('text-sm font-semibold text-fg', mono && 'font-mono text-[12px]')}>
        {value}
        {unit ? <span className="ml-1 text-[11px] font-normal text-fg-dim">{unit}</span> : null}
      </div>
      {sub ? <div className="mt-1 text-[11px] text-fg-dim">{sub}</div> : null}
    </div>
  )
}
