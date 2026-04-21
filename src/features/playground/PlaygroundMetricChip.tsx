type Props = {
  label: string
  value: string
}

export function PlaygroundMetricChip({ label, value }: Props) {
  return (
    <span className="inline-flex items-center gap-1 rounded-[3px] border border-border bg-surface-2 px-2 py-1 font-mono text-[11px]">
      {label ? <span className="text-fg-dim">{label}</span> : null}
      <span className="text-fg">{value}</span>
    </span>
  )
}
