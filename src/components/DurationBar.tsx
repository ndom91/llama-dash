export function DurationBar({ ms, max, isErr = false }: { ms: number; max: number; isErr?: boolean }) {
  const pct = max > 0 ? Math.min(100, Math.max(2, (ms / max) * 100)) : 0
  return (
    <span className="dur">
      <span className="dur-bar">
        <span className={`dur-bar-fill${isErr ? ' is-err' : ''}`} style={{ width: `${pct}%` }} />
      </span>
      <span className="dur-val">{formatMs(ms)}</span>
    </span>
  )
}

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms} ms`
  const s = ms / 1000
  if (s < 60) return `${s.toFixed(s < 10 ? 2 : 1)} s`
  const m = Math.floor(s / 60)
  const rem = Math.floor(s % 60)
  return `${m}m ${rem}s`
}
