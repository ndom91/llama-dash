type Props = {
  label: string
  action?: React.ReactNode
  children: React.ReactNode
}

export function PlaygroundInspectorSection({ label, action, children }: Props) {
  return (
    <section className="flex flex-col gap-1.5 py-1.5">
      <div className="flex items-center justify-between gap-2 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-fg-faint">
        <span>{label}</span>
        {action}
      </div>
      <div className="flex flex-col gap-2">{children}</div>
    </section>
  )
}
