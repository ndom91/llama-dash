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
    <div className="pg-am-cell">
      <div className="pg-am-label">{label}</div>
      <div className={cn('pg-am-value', mono && 'font-mono text-[12px]')}>
        {value}
        {unit ? <span className="pg-am-unit">{unit}</span> : null}
      </div>
      {sub ? <div className="pg-am-sub">{sub}</div> : null}
    </div>
  )
}
