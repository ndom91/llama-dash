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
    <div className="flex flex-col gap-2">
      {rows.map((row) => {
        const width = row.ms != null && max > 0 ? (row.ms / max) * 100 : 0
        const stub = row.ms == null
        return (
          <div key={row.label} className="grid grid-cols-[72px_minmax(0,1fr)_56px] items-center gap-2">
            <span className="font-mono text-[11px] text-fg-muted">{row.label}</span>
            <div className="h-2 overflow-hidden rounded bg-surface-3">
              <div
                className={[
                  'h-full rounded',
                  row.tone === 'accent' ? 'bg-accent' : row.tone === 'warn' ? 'bg-warn' : 'bg-fg-dim',
                  stub ? 'opacity-50' : '',
                ].join(' ')}
                style={{ width: `${Math.max(stub ? 2 : 1, width)}%` }}
              />
            </div>
            <span className="text-right font-mono text-[11px] text-fg-dim">
              {row.ms != null ? `${Math.round(row.ms)}ms` : '—'}
            </span>
          </div>
        )
      })}
    </div>
  )
}
