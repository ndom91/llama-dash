import { useId } from 'react'

export type ChartSeries = {
  id: string
  values: Array<number | null>
  color: string
  /** Fill the area under the line with a faint gradient. */
  area?: boolean
  /** Plot against the right-hand domain instead of the left. */
  secondary?: boolean
}

export type ChartBand = { start: number; end: number }

const VIEW_W = 1000

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
  secondaryDomain,
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
  secondaryDomain?: [number, number]
  height: number
  bands?: Array<ChartBand>
  /** Dashed horizontal line on the primary domain. */
  thresholdLine?: number | null
  yTicks?: Array<number>
  xLabels?: Array<string>
}) {
  const gradientId = `ts-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  const span = Math.max(1, toMs - fromMs)
  const x = (time: number) => ((time - fromMs) / span) * VIEW_W
  const yFor =
    ([min, max]: [number, number]) =>
    (value: number) => {
      const clamped = Math.min(max, Math.max(min, value))
      return height - ((clamped - min) / Math.max(1e-9, max - min)) * (height - 2) - 1
    }
  const yPrimary = yFor(domain)
  const ySecondary = yFor(secondaryDomain ?? domain)

  return (
    <div className="relative min-w-0">
      {yTicks ? (
        <div className="pointer-events-none absolute inset-y-0 left-0 w-7" aria-hidden="true">
          {yTicks.map((tick) => (
            <span
              key={tick}
              className="absolute right-1 -translate-y-1/2 font-mono text-[9px] tabular-nums text-fg-faint"
              style={{ top: yPrimary(tick) }}
            >
              {tick}
            </span>
          ))}
        </div>
      ) : null}
      <svg
        viewBox={`0 0 ${VIEW_W} ${height}`}
        preserveAspectRatio="none"
        className={yTicks ? 'ml-7 block w-[calc(100%-1.75rem)]' : 'block w-full'}
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
            y1={yPrimary(tick)}
            y2={yPrimary(tick)}
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
            y1={yPrimary(thresholdLine)}
            y2={yPrimary(thresholdLine)}
            stroke="var(--fg-dim)"
            strokeDasharray="4 4"
            strokeOpacity={0.7}
            vectorEffect="non-scaling-stroke"
          />
        ) : null}
        {series.map((s) => {
          const { line, area } = buildPaths(t, s.values, x, s.secondary ? ySecondary : yPrimary, height)
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
