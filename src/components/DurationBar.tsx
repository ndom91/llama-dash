import { buildTimingPhases, TIMING_PHASE_TONE_CLASS, type DisplayTimingInput } from '../lib/timing-phases'
import { cn } from '../lib/cn'

type Props = {
  ms: number
  timing?: DisplayTimingInput | null
  isErr?: boolean
}

export function DurationBar({ ms, timing = null, isErr = false }: Props) {
  const phases = buildTimingPhases(ms, timing ?? {})
  const barPhases = phases.filter((phase) => phase.ms > 0)
  const total = Math.max(
    ms,
    barPhases.reduce((sum, phase) => sum + phase.ms, 0),
    1,
  )

  return (
    <span className="inline-flex min-w-[90px] items-center justify-end gap-2">
      <span className="block h-1 max-w-[60px] flex-1 overflow-hidden rounded-pill bg-surface-3">
        <span className="flex h-full w-full overflow-hidden rounded-pill">
          {barPhases.map((phase) => (
            <span
              key={phase.key}
              className={cn('h-full min-w-px', TIMING_PHASE_TONE_CLASS[phase.tone])}
              style={{ width: `${(phase.ms / total) * 100}%` }}
              title={`${phase.label}: ${formatMs(phase.ms)}`}
            />
          ))}
        </span>
      </span>
      <span
        className={cn(
          'min-w-[52px] text-right font-mono text-[11px] tabular-nums whitespace-nowrap',
          isErr ? 'text-err' : 'text-fg',
        )}
      >
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
