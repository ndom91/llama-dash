let filterId = 0

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

  const id = `spark-glow-${++filterId}`
  const vw = 200
  const max = Math.max(...data, 1)
  const step = vw / (data.length - 1)
  const points = data.map((v, i) => `${i * step},${height - (v / max) * height * 0.8 - 2}`).join(' ')

  return (
    <svg
      viewBox={`0 0 ${vw} ${height}`}
      preserveAspectRatio="none"
      className="sparkline"
      style={{ height }}
      aria-hidden="true"
    >
      <defs>
        <filter id={id}>
          <feGaussianBlur in="SourceGraphic" stdDeviation="3" />
        </filter>
      </defs>
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeOpacity={0.35}
        filter={`url(#${id})`}
      />
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
