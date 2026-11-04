import type { ReactNode } from 'react'
import { StatusDot } from '../../components/StatusDot'
import { cn } from '../../lib/cn'
import type { Tone } from './systemMetrics'
import { TimeSeriesChart } from './TimeSeriesChart'

const TONE_TEXT: Record<Tone, string> = { ok: 'text-fg', warn: 'text-warn', err: 'text-err', idle: 'text-fg-dim' }
const TONE_BORDER: Record<Tone, string> = {
  ok: 'border-border',
  warn: 'border-warn/50',
  err: 'border-err/50',
  idle: 'border-border',
}
const TONE_COLOR: Record<Tone, string> = {
  ok: 'var(--series-1)',
  warn: 'var(--warn)',
  err: 'var(--err)',
  idle: 'var(--fg-faint)',
}

export function SystemResourceTile({
  label,
  aside,
  value,
  unit,
  meta,
  percent,
  thresholdPercent,
  tone,
  t,
  values,
  fromMs,
  toMs,
  domain,
}: {
  label: string
  aside?: ReactNode
  value: ReactNode
  unit?: ReactNode
  meta?: ReactNode
  percent: number | null
  thresholdPercent?: number | null
  tone: Tone
  t: Array<number>
  values: Array<number | null>
  fromMs: number
  toMs: number
  domain: [number, number]
}) {
  const color = TONE_COLOR[tone]
  return (
    <section
      className={cn(
        'flex min-w-0 flex-col rounded border bg-surface-1 px-4 pt-3 pb-2 transition-[border-color] duration-200',
        TONE_BORDER[tone],
      )}
    >
      <div className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-fg-faint">
        <StatusDot tone={tone} />
        <span>{label}</span>
        {aside ? <span className="ml-auto normal-case tracking-normal text-fg-faint">{aside}</span> : null}
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className={cn('font-mono text-3xl font-semibold tabular-nums tracking-[-0.04em]', TONE_TEXT[tone])}>
          {value}
        </span>
        {unit ? <span className="font-mono text-xs text-fg-dim">{unit}</span> : null}
      </div>
      <div className="mt-0.5 min-h-4 truncate font-mono text-[10px] text-fg-dim">{meta}</div>
      <div className="relative mt-3 h-1 rounded-pill bg-surface-3">
        <div
          className="absolute inset-y-0 left-0 rounded-pill transition-[width] duration-300 ease-out"
          style={{ width: `${Math.min(100, Math.max(0, percent ?? 0))}%`, background: color }}
        />
        {thresholdPercent != null ? (
          <div
            className="absolute -top-1 h-3 w-px bg-fg-dim"
            style={{ left: `${Math.min(100, thresholdPercent)}%` }}
            aria-hidden="true"
          />
        ) : null}
      </div>
      <div className="mt-2">
        <TimeSeriesChart
          t={t}
          series={[{ id: 'v', values, color, area: true }]}
          fromMs={fromMs}
          toMs={toMs}
          domain={domain}
          height={36}
        />
      </div>
    </section>
  )
}
