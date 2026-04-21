type Props = {
  k: string
  v: React.ReactNode
}

export function PlaygroundKVRow({ k, v }: Props) {
  return (
    <div className="flex items-center justify-between py-0.5 font-mono text-[11px]">
      <span className="text-fg-muted">{k}</span>
      <span className="inline-flex items-center gap-1.5">{v}</span>
    </div>
  )
}
