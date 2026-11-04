import { type PointerEvent, useId, useState } from 'react'
import { cn } from '../../lib/cn'
import { TimeSeriesTooltip } from './TimeSeriesTooltip'

export type ChartSeries = {
  id: string
  label: string
  values: Array<number | null>
  color: string
  format: (value: number) => string
  area?: boolean
}

export type ChartBand = { start: number; end: number; label: string }

const VIEW_W = 1000
const SPARKLINE_MAX_HEIGHT = 60

function buildPaths(
  t: Array<number>,
  values: Array<number | null>,
  x: (t: number) => number,
  y: (v: number) => number,
  height: number,
) {
  const segments: Array<Array<{ x: number; y: number }>> = []
  let current: Array<{ x: number; y: number }> = []
  values.forEach((value, i) => {
    if (value == null) {
      if (current.length > 0) segments.push(current)
      current = []
      return
    }
    current.push({ x: x(t[i]), y: y(value) })
  })
  if (current.length > 0) segments.push(current)

  const line = segments
    .filter((segment) => segment.length > 1)
    .map((segment) => `M${segment.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' L')}`)
    .join(' ')
  const area = segments
    .filter((segment) => segment.length > 1)
    .map(
      (segment) =>
        `M${segment[0].x.toFixed(1)},${height} L${segment.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' L')} L${segment[segment.length - 1].x.toFixed(1)},${height} Z`,
    )
    .join(' ')
  return { line, area }
}

/** Index of the sample closest to `time`; `t` is sorted ascending. */
function nearestIndex(t: Array<number>, time: number): number {
  let lo = 0
  let hi = t.length - 1
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (t[mid] < time) lo = mid + 1
    else hi = mid
  }
  return lo > 0 && time - t[lo - 1] < t[lo] - time ? lo - 1 : lo
}

/**
 * Plain-SVG time series. The SVG stretches to its box, so strokes use non-scaling-stroke and all
 * text lives in HTML overlays to avoid distortion.
 */
export function TimeSeriesChart({
  t,
  series,
  fromMs,
  toMs,
  domain,
  height,
  bands = [],
  thresholdLine,
  yTicks,
  xLabels,
}: {
  t: Array<number>
  series: Array<ChartSeries>
  fromMs: number
  toMs: number
  domain: [number, number]
  height: number
  bands?: Array<ChartBand>
  thresholdLine?: number | null
  yTicks?: Array<number>
  xLabels?: Array<string>
}) {
  const gradientId = `ts-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)
  const span = Math.max(1, toMs - fromMs)
  const x = (time: number) => ((time - fromMs) / span) * VIEW_W
  const [min, max] = domain
  const y = (value: number) => {
    const clamped = Math.min(max, Math.max(min, value))
    return height - ((clamped - min) / Math.max(1e-9, max - min)) * (height - 2) - 1
  }

  // How far the pointer may be from a sample (or band edge) and still count as hovering it.
  const hoverTolerance = span / 30

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (t.length === 0) return
    const rect = event.currentTarget.getBoundingClientRect()
    const time = fromMs + ((event.clientX - rect.left) / rect.width) * span
    const index = nearestIndex(t, time)
    // Past either end of the data (e.g. history still filling after a restart) there is nothing to show.
    setHoverIndex(Math.abs(t[index] - time) <= hoverTolerance ? index : null)
  }
  const hoverTime = hoverIndex == null ? null : t[hoverIndex]
  const hoverLeft = hoverTime == null ? 0 : (x(hoverTime) / VIEW_W) * 100

  return (
    <div className="relative min-w-0">
      {yTicks ? (
        <div className="pointer-events-none absolute inset-y-0 left-0 w-7" aria-hidden="true">
          {yTicks.map((tick) => (
            <span
              key={tick}
              className="absolute right-1 -translate-y-1/2 font-mono text-[9px] tabular-nums text-fg-faint"
              style={{ top: y(tick) }}
            >
              {tick}
            </span>
          ))}
        </div>
      ) : null}
      <div
        className={cn('relative', yTicks && 'ml-7')}
        onPointerMove={onPointerMove}
        onPointerLeave={() => setHoverIndex(null)}
      >
        <svg
          viewBox={`0 0 ${VIEW_W} ${height}`}
          preserveAspectRatio="none"
          className="block w-full"
          style={{ height }}
          aria-hidden="true"
        >
          <defs>
            {series.map((s) => (
              <linearGradient key={s.id} id={`${gradientId}-${s.id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.color} stopOpacity={0.22} />
                <stop offset="100%" stopColor={s.color} stopOpacity={0.02} />
              </linearGradient>
            ))}
          </defs>
          {yTicks?.map((tick) => (
            <line
              key={tick}
              x1={0}
              x2={VIEW_W}
              y1={y(tick)}
              y2={y(tick)}
              stroke="var(--border)"
              strokeOpacity={0.5}
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {bands.map((band) => (
            <rect
              key={`${band.start}-${band.end}`}
              x={x(band.start)}
              width={Math.max(2, x(band.end) - x(band.start))}
              y={0}
              height={height}
              fill="var(--fg-faint)"
              opacity={0.12}
            />
          ))}
          {thresholdLine != null ? (
            <line
              x1={0}
              x2={VIEW_W}
              y1={y(thresholdLine)}
              y2={y(thresholdLine)}
              stroke="var(--fg-dim)"
              strokeDasharray="4 4"
              strokeOpacity={0.7}
              vectorEffect="non-scaling-stroke"
            />
          ) : null}
          {series.map((s) => {
            const { line, area } = buildPaths(t, s.values, x, y, height)
            return (
              <g key={s.id}>
                {s.area ? <path d={area} fill={`url(#${gradientId}-${s.id})`} /> : null}
                <path
                  d={line}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={1.25}
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
              </g>
            )
          })}
        </svg>
        {hoverIndex != null && hoverTime != null ? (
          <>
            <div
              className="pointer-events-none absolute inset-y-0 w-px bg-fg-dim/60"
              style={{ left: `${hoverLeft}%` }}
              aria-hidden="true"
            />
            {series.map((s) => {
              const value = s.values[hoverIndex]
              return value == null ? null : (
                <div
                  key={s.id}
                  className="pointer-events-none absolute size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-pill ring-2 ring-surface-1"
                  style={{ left: `${hoverLeft}%`, top: y(value), background: s.color }}
                  aria-hidden="true"
                />
              )
            })}
            <TimeSeriesTooltip
              time={hoverTime}
              rows={series.map((s) => ({ ...s, value: s.values[hoverIndex] }))}
              notes={bands
                .filter((band) => hoverTime >= band.start && hoverTime <= band.end + hoverTolerance)
                .map((band) => band.label)}
              leftPercent={hoverLeft}
              above={height < SPARKLINE_MAX_HEIGHT}
            />
          </>
        ) : null}
      </div>
      {xLabels ? (
        <div
          className={`mt-1 flex justify-between font-mono text-[9px] tabular-nums text-fg-faint ${yTicks ? 'ml-7' : ''}`}
          aria-hidden="true"
        >
          {xLabels.map((label) => (
            <span key={label}>{label}</span>
          ))}
        </div>
      ) : null}
    </div>
  )
}
