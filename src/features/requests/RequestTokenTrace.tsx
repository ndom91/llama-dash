import {
  buildTimingPhases,
  sumKnownTimingPhases,
  TIMING_PHASE_TONE_CLASS,
  type DisplayTimingInput,
  type TimingPhase,
} from '../../lib/timing-phases.ts'
import { cn } from '../../lib/cn'
import { formatDuration, formatPhaseMs, type RequestTiming } from './requestDetailUtils'

export type { TimingPhase }
export { buildTimingPhases, sumKnownTimingPhases }

type Props = {
  durationMs: number
  timing: RequestTiming
}

export function RequestTokenTrace({ durationMs, timing }: Props) {
  const phases = buildTimingPhases(durationMs, timing)
  const barPhases = phases.filter((phase) => phase.ms > 0)
  const total = Math.max(
    durationMs,
    barPhases.reduce((sum, phase) => sum + phase.ms, 0),
    1,
  )
  const phaseSum = phases.reduce((sum, phase) => sum + phase.ms, 0)

  return (
    <section className="panel !rounded-none !border-l-0 !border-r-0 border-b-1 !bg-surface-1">
      <div className="px-4 py-3">
        <div className="flex h-2 overflow-hidden rounded bg-surface-3">
          {barPhases.map((phase) => (
            <div
              key={phase.key}
              className={cn('h-full min-w-px', TIMING_PHASE_TONE_CLASS[phase.tone])}
              style={{ width: `${(phase.ms / total) * 100}%` }}
              title={`${phase.label}: ${formatDuration(phase.ms)}`}
            />
          ))}
        </div>
        <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1.5 font-mono tabular-nums text-[11px]">
          {phases.map((phase) => (
            <span key={phase.key} className="inline-flex items-center gap-1.5 text-fg-dim">
              <span className={cn('inline-block size-1.5 rounded-sm', TIMING_PHASE_TONE_CLASS[phase.tone])} />
              <span>{phase.label}</span>
              <span className="text-fg">{formatPhaseMs(phase.ms)}</span>
            </span>
          ))}
          <span className="inline-flex items-center gap-1.5 text-fg-muted">
            <span>total</span>
            <span className="text-fg">{formatDuration(durationMs)}</span>
          </span>
          {phaseSum !== durationMs ? (
            <span className="inline-flex items-center gap-1.5 text-fg-muted">
              <span>sum</span>
              <span>{formatDuration(phaseSum)}</span>
            </span>
          ) : null}
        </div>
      </div>
    </section>
  )
}

/** Narrow timing for list rows / DurationBar. */
export type ListRequestTiming = DisplayTimingInput
