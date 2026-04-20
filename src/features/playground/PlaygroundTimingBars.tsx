import { cn } from '../../lib/cn'
import type { InspectorState } from '../../lib/use-playground-chat'

type Props = {
  inspector: InspectorState
}

export function PlaygroundTimingBars({ inspector }: Props) {
  const timing = inspector.timing
  const total = inspector.lastMetrics.totalMs ?? 0
  const rows: Array<{ label: string; ms: number | null; tone: 'neutral' | 'accent' | 'warn' }> = [
    { label: 'queue', ms: timing.queueMs, tone: 'neutral' },
    { label: 'model swap', ms: timing.swapMs, tone: 'neutral' },
    { label: 'prefill', ms: timing.prefillMs, tone: 'warn' },
    { label: 'decode', ms: timing.decodeMs, tone: 'accent' },
    { label: 'stream close', ms: timing.streamCloseMs, tone: 'neutral' },
  ]
  const max = total || Math.max(...rows.map((row) => row.ms ?? 0), 1)

  return (
    <div className="pg-timing-rows">
      {rows.map((row) => {
        const width = row.ms != null && max > 0 ? (row.ms / max) * 100 : 0
        const stub = row.ms == null
        return (
          <div key={row.label} className="pg-timing-row">
            <span className="pg-timing-label">{row.label}</span>
            <div className="pg-timing-track">
              <div
                className={cn('pg-timing-bar', `pg-timing-bar-${row.tone}`, stub && 'pg-timing-bar-stub')}
                style={{ width: `${Math.max(stub ? 2 : 1, width)}%` }}
              />
            </div>
            <span className="pg-timing-ms">{row.ms != null ? `${Math.round(row.ms)}ms` : '—'}</span>
          </div>
        )
      })}
    </div>
  )
}
