type Props = {
  label: string
  value: number
  min: number
  max: number
  step: number
  decimals: number
  onChange: (v: number) => void
  format?: (v: number) => string
}

export function PlaygroundSlider({ label, value, min, max, step, decimals, onChange, format }: Props) {
  const pct = ((value - min) / (max - min)) * 100
  const display = format ? format(value) : value.toFixed(decimals)

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between font-mono text-[11px]">
        <span className="text-fg-muted">{label}</span>
        <span className="font-medium text-fg tabular-nums">{display}</span>
      </div>
      <input
        type="range"
        className="pg-rail-slider"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ '--pct': `${pct}%` } as React.CSSProperties}
      />
      <div className="flex justify-between font-mono tabular-nums text-[9px] text-fg-faint">
        <span>{format ? format(min) : min}</span>
        <span>{format ? format((min + max) / 2) : ((min + max) / 2).toFixed(decimals)}</span>
        <span>{format ? format(max) : max}</span>
      </div>
    </div>
  )
}
