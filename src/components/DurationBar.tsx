import { cn } from '../lib/cn'

const BASELINE_MS = 5000

export function DurationBar({ ms, isErr = false }: { ms: number; isErr?: boolean }) {
  const pct = Math.min(100, (ms / BASELINE_MS) * 100)
  return (
    <span className="inline-flex items-center gap-2 justify-end min-w-[90px]">
      <span className="block flex-1 max-w-[60px] h-1 rounded-pill bg-fg-faint overflow-hidden">
        <span
          className={cn('block h-full rounded-pill', isErr ? 'bg-err' : 'bg-accent')}
          style={{ width: `${pct}%` }}
        />
      </span>
      <span className="font-mono tabular-nums text-[11px] text-fg min-w-[52px] text-right whitespace-nowrap">
        {formatMs(ms)}
      </span>
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
