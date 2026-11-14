import { useSyncExternalStore } from 'react'
import { cn } from '../../lib/cn'
import type { RealtimeLevelSource } from '../../lib/use-playground-realtime'

// RMS levels are small; a square-root scale makes quiet speech visible.
const FULL_SCALE = 0.3

function levelToFraction(level: number): number {
  return Math.min(1, Math.sqrt(Math.max(0, level) / FULL_SCALE))
}

type Props = {
  source: RealtimeLevelSource
  /** Shows an empty meter, e.g. while the mic is off. */
  muted?: boolean
  threshold: number | null
  active: boolean
}

const serverLevel = () => 0

export function PlaygroundRealtimeLevelMeter({ source, muted = false, threshold, active }: Props) {
  const level = useSyncExternalStore(source.subscribe, source.get, serverLevel)
  const fill = muted ? 0 : levelToFraction(level)
  return (
    <div className="relative h-1.5 w-28 overflow-hidden rounded-full bg-surface-3" aria-hidden="true">
      <div
        className={cn(
          'h-full rounded-full transition-[width] duration-75 ease-out',
          active ? 'bg-accent' : 'bg-fg-faint',
        )}
        style={{ width: `${fill * 100}%` }}
      />
      {threshold != null ? (
        <span
          className="absolute top-0 bottom-0 w-px bg-fg"
          style={{ left: `${levelToFraction(threshold) * 100}%` }}
          aria-hidden="true"
        />
      ) : null}
    </div>
  )
}
