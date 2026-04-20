type Props = {
  label: string
  value: string
}

export function PlaygroundMetricChip({ label, value }: Props) {
  return (
    <span className="pg-metric-chip">
      {label ? <span className="pg-metric-label">{label}</span> : null}
      <span className="pg-metric-value">{value}</span>
    </span>
  )
}
