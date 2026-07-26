type Props = {
  action?: React.ReactNode
  children: React.ReactNode
}

export function PlaygroundInspectorSection({ action, children }: Props) {
  return (
    <section className="flex flex-col gap-1.5 border-b border-dashed border-border py-2.5 last:border-b-0">
      {action ? <div className="flex items-center justify-end gap-2">{action}</div> : null}
      <div className="flex flex-col gap-2">{children}</div>
    </section>
  )
}
