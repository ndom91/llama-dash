let nextId = 0

export function Sparkline({
  data,
  height = 40,
  color = 'var(--accent)',
}: {
  data: Array<number>
  height?: number
  color?: string
}) {
  if (data.length < 2) return null

  const id = `spark-${++nextId}`
  const vw = 200
  const max = Math.max(...data, 1)
  const step = vw / (data.length - 1)
  const points = data.map((v, i) => `${i * step},${height - (v / max) * height * 0.75 - 2}`)
  const line = points.join(' ')
  const area = `0,${height} ${line} ${vw},${height}`

  return (
    <svg
      viewBox={`0 0 ${vw} ${height}`}
      preserveAspectRatio="none"
      className="sparkline"
      style={{ height }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.3} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#${id}-fill)`} />
      <polyline
        points={line}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
