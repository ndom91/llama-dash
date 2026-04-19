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
  const glowH = 24
  const coords = data.map((v, i) => ({
    x: i * step,
    y: height - (v / max) * height * 0.75 - 2,
  }))
  const line = coords.map((p) => `${p.x},${p.y}`).join(' ')
  const glowArea = [
    ...coords.map((p) => `${p.x},${p.y}`),
    ...coords
      .slice()
      .reverse()
      .map((p) => `${p.x},${Math.max(0, p.y - glowH)}`),
  ].join(' ')

  return (
    <svg
      viewBox={`0 0 ${vw} ${height}`}
      preserveAspectRatio="none"
      className="block w-full mt-auto"
      style={{ height }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`${id}-glow`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0} />
          <stop offset="40%" stopColor={color} stopOpacity={0} />
          <stop offset="75%" stopColor={color} stopOpacity={0.06} />
          <stop offset="100%" stopColor={color} stopOpacity={0.18} />
        </linearGradient>
      </defs>
      <polygon points={glowArea} fill={`url(#${id}-glow)`} />
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
