type Props = {
  label: string
  action?: React.ReactNode
  children: React.ReactNode
}

export function PlaygroundInspectorSection({ label, action, children }: Props) {
  return (
    <section className="pg-rail-section">
      <div className="pg-rail-heading pg-rail-heading-row">
        <span>{label}</span>
        {action}
      </div>
      <div className="pg-rail-body">{children}</div>
    </section>
  )
}
