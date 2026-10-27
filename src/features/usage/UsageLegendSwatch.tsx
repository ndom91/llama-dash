export function UsageLegendSwatch({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 font-mono text-[11px] text-fg-dim">
      <span className="inline-block size-2 shrink-0 rounded-sm" style={{ background: color }} aria-hidden="true" />
      {label}
    </span>
  )
}
