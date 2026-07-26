import type { InspectorState, InspectorTiming } from '../../lib/use-playground-chat'

type Props = {
  inspector: InspectorState
}

type Tone = 'neutral' | 'accent' | 'warn' | 'info'

type Row = { label: string; key: string; ms: number; tone: Tone }

function buildRows(total: number, timing: InspectorTiming): Array<Row> {
  const rows: Array<Row> = [
    { key: 'queue', label: 'queue', ms: Math.max(0, timing.queueMs ?? 0), tone: 'neutral' },
    {
      key: 'model_loading',
      label: 'model loading',
      ms: Math.max(0, timing.modelLoadingMs ?? 0),
      tone: 'info',
    },
    { key: 'prefill', label: 'prefill', ms: Math.max(0, timing.prefillMs ?? 0), tone: 'warn' },
    { key: 'reasoning', label: 'reasoning', ms: Math.max(0, timing.reasoningMs ?? 0), tone: 'accent' },
    { key: 'response', label: 'response', ms: Math.max(0, timing.responseMs ?? 0), tone: 'accent' },
  ]

  let accounted = rows.reduce((sum, row) => sum + row.ms, 0)
  if (accounted > total && total > 0) {
    let excess = accounted - total
    for (let i = rows.length - 1; i >= 0 && excess > 0; i--) {
      const row = rows[i]!
      const cut = Math.min(row.ms, excess)
      row.ms -= cut
      excess -= cut
    }
    accounted = rows.reduce((sum, row) => sum + row.ms, 0)
  }

  const otherMs = total > 0 ? Math.max(0, total - accounted) : 0
  rows.push({ key: 'other', label: 'other', ms: otherMs, tone: 'neutral' })
  return rows
}

export function PlaygroundTimingBars({ inspector }: Props) {
  const timing = inspector.timing
  const total = inspector.lastMetrics.totalMs ?? 0
  const rows = buildRows(total, timing)
  const max = total || Math.max(...rows.map((row) => row.ms), 1)

  return (
    <div className="flex flex-col gap-2">
      {rows.map((row) => {
        const showMs = row.ms > 0
        const width = showMs && max > 0 ? (row.ms / max) * 100 : 0
        return (
          <div key={row.key} className="grid grid-cols-[96px_minmax(0,1fr)_minmax(4.5rem,auto)] items-center gap-2">
            <span className="font-mono text-[11px] text-fg-muted">{row.label}</span>
            <div className="h-2 overflow-hidden rounded bg-surface-3">
              <div
                className={[
                  'h-full rounded',
                  row.tone === 'accent'
                    ? 'bg-accent'
                    : row.tone === 'warn'
                      ? 'bg-warn'
                      : row.tone === 'info'
                        ? 'bg-info'
                        : 'bg-fg-dim',
                  !showMs ? 'opacity-40' : '',
                ].join(' ')}
                style={{ width: `${Math.max(showMs ? 1 : 0, width)}%` }}
              />
            </div>
            <span className="text-right font-mono tabular-nums text-[11px] text-fg-dim">
              {showMs ? `${Math.round(row.ms).toLocaleString()} ms` : '—'}
            </span>
          </div>
        )
      })}
      {total > 0 ? (
        <div className="grid grid-cols-[96px_minmax(0,1fr)_minmax(4.5rem,auto)] items-center gap-2 pt-1">
          <span className="font-mono text-[11px] text-fg-muted">total</span>
          <div />
          <span className="text-right font-mono tabular-nums text-[11px] text-fg">
            {Math.round(total).toLocaleString()} ms
          </span>
        </div>
      ) : null}
    </div>
  )
}
