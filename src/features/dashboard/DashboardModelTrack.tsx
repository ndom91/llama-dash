import type { ApiModelActivityEntry } from '../../lib/api'
import { cn } from '../../lib/cn'
import type { ResidencyFrame, ResidencySpan } from './modelResidency'

type Props = {
  frame: ResidencyFrame
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
      <span
        className={cn(
          'absolute inset-x-0 top-1/2 -translate-y-1/2',
          isPeer ? 'border-t border-dashed border-fg-faint' : 'h-px bg-border',
        )}
      />
      {spans.map((span) => {
        const left = pct(span.start, frame)
        const isLoading = loading && span.open
        return (
          <span
            key={span.start}
            className={cn(
              'absolute top-[3px] bottom-[3px] rounded-[2px]',
              isLoading && 'residency-span-loading',
              span.start === frame.start && 'rounded-l-none',
            )}
            style={{
              left: `${left}%`,
              width: `${Math.max(pct(span.end, frame) - left, 0.6)}%`,
              background: isLoading ? undefined : (color ?? undefined),
            }}
          />
        )
      })}
      {activity?.ticks.map((tick) => {
        const left = pct(frame.start + (tick.bucket + 0.5) * bucketMs, frame)
        return (
          <span
            key={tick.bucket}
            className={cn(
              'residency-tick absolute top-0 bottom-0 w-px',
              tick.errors > 0 ? 'bg-err' : isPeer ? 'bg-fg-dim' : 'bg-fg',
              tick.count > 1 || tick.errors > 0 ? 'opacity-100' : 'opacity-75',
            )}
            style={{ left: `${left}%` }}
          />
        )
      })}
    </div>
  )
}
