type Props = {
  label: string
  action?: React.ReactNode
  children: React.ReactNode
}

export function PlaygroundSessionSection({ label, action, children }: Props) {
  return (
    <section className="flex flex-col gap-1.5 border-b border-dashed border-[color:color-mix(in_srgb,var(--border)_75%,transparent)] py-2.5 last:border-b-0">
      <div className="flex items-center justify-between gap-2">
        <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-fg-faint">{label}</div>
        {action}
      </div>
      <div className="flex flex-col gap-2">{children}</div>
    </section>
  )
}
