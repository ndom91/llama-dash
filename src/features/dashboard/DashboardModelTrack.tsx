import type { ApiModelActivityEntry } from '../../lib/api'
import { cn } from '../../lib/cn'
import type { ResidencyFrame, ResidencySpan } from './modelResidency'

type Props = {
  frame: ResidencyFrame
  /** Identity colour for resident spans; null for peers, which have no local residency. */
  color: string | null
  spans: ReadonlyArray<ResidencySpan>
  loading: boolean
  activity: ApiModelActivityEntry | undefined
  bucketMs: number
  variant: 'local' | 'peer'
  dim?: boolean
}

function pct(value: number, frame: ResidencyFrame) {
  return ((value - frame.start) / (frame.end - frame.start)) * 100
}

export function DashboardModelTrack({ frame, color, spans, loading, activity, bucketMs, variant, dim }: Props) {
  const isPeer = variant === 'peer'
  return (
    <div className={cn('relative h-4', dim && 'opacity-60')} aria-hidden="true">
      {/* Baseline: solid for local models, dashed for peers whose residency
          the backend does not report. */}
      <span
        className={cn(
          'absolute inset-x-0 top-1/2 -translate-y-1/2',
          isPeer ? 'border-t border-dashed border-fg-faint' : 'h-px bg-border',
        )}
      />
      {spans.map((span, index) => {
        const left = pct(span.start, frame)
        const width = Math.max(pct(span.end, frame) - left, 0.6)
        const isLoading = loading && span.open
        return (
          <span
            key={span.start}
            className={cn(
              'absolute top-[3px] bottom-[3px] rounded-[2px]',
              isLoading && 'residency-span-loading',
              // Span edges that start at the window boundary continue off-screen.
              index === 0 && left <= 0 && 'rounded-l-none',
            )}
            style={{
              left: `${Math.max(left, 0)}%`,
              width: `${Math.min(width, 100 - Math.max(left, 0))}%`,
              background: isLoading ? undefined : (color ?? undefined),
            }}
          />
        )
      })}
      {activity?.ticks.map((tick) => {
        const at = frame.start + (tick.bucket + 0.5) * bucketMs
        const left = pct(at, frame)
        if (left < 0 || left > 100) return null
        return (
          <span
            key={tick.bucket}
            className={cn(
              'residency-tick absolute top-0 bottom-0 w-px',
              tick.errors > 0 ? 'bg-err' : isPeer ? 'bg-fg-dim' : 'bg-fg',
              // Busier buckets render at full strength; single requests a touch quieter.
              tick.count > 1 || tick.errors > 0 ? 'opacity-100' : 'opacity-75',
            )}
            style={{ left: `${left}%` }}
          />
        )
      })}
    </div>
  )
}
