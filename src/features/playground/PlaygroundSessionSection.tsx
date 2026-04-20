type Props = {
  label: string
  children: React.ReactNode
}

export function PlaygroundSessionSection({ label, children }: Props) {
  return (
    <section className="pg-rail-section">
      <div className="pg-rail-heading">{label}</div>
      <div className="pg-rail-body">{children}</div>
    </section>
  )
}
