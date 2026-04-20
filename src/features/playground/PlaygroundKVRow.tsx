type Props = {
  k: string
  v: React.ReactNode
}

export function PlaygroundKVRow({ k, v }: Props) {
  return (
    <div className="pg-kv-row">
      <span className="pg-kv-key">{k}</span>
      <span className="pg-kv-val-wrap">{v}</span>
    </div>
  )
}
