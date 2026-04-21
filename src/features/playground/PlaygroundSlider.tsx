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
    <div className="flex flex-col gap-0.75">
      <div className="flex justify-between font-mono text-[11px]">
        <span className="text-fg-muted">{label}</span>
        <span className="font-medium text-fg">{display}</span>
      </div>
      <input
        type="range"
        className="h-[3px] w-full cursor-pointer appearance-none rounded-[2px] bg-[linear-gradient(to_right,var(--accent)_0%,var(--accent)_var(--pct,0%),var(--bg-3)_var(--pct,0%),var(--bg-3)_100%)] outline-none [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-surface-1 [&::-webkit-slider-thumb]:bg-fg [&::-webkit-slider-thumb]:cursor-pointer [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-surface-1 [&::-moz-range-thumb]:bg-fg [&::-moz-range-thumb]:cursor-pointer"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ '--pct': `${pct}%` } as React.CSSProperties}
      />
      <div className="flex justify-between font-mono text-[9px] text-fg-faint">
        <span>{format ? format(min) : min}</span>
        <span>{format ? format((min + max) / 2) : ((min + max) / 2).toFixed(decimals)}</span>
        <span>{format ? format(max) : max}</span>
      </div>
    </div>
  )
}
