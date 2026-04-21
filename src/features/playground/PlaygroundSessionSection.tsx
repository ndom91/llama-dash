type Props = {
  label: string
  children: React.ReactNode
}

export function PlaygroundSessionSection({ label, children }: Props) {
  return (
    <section className="flex flex-col gap-1.5 border-b border-dashed border-[color:color-mix(in_srgb,var(--border)_75%,transparent)] py-2.5 last:border-b-0">
      <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-fg-faint">{label}</div>
      <div className="flex flex-col gap-2">{children}</div>
    </section>
  )
}
