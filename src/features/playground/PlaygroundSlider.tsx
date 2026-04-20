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
    <div className="pg-slider-row">
      <div className="pg-slider-head">
        <span className="pg-slider-label">{label}</span>
        <span className="pg-slider-value">{display}</span>
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
      <div className="pg-slider-scale">
        <span>{format ? format(min) : min}</span>
        <span>{format ? format((min + max) / 2) : ((min + max) / 2).toFixed(decimals)}</span>
        <span>{format ? format(max) : max}</span>
      </div>
    </div>
  )
}
