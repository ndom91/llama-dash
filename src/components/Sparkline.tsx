export function Sparkline({
  data,
  width = 160,
  height = 40,
  color = 'var(--accent)',
}: {
  data: Array<number>
  width?: number
  height?: number
  color?: string
}) {
  if (data.length < 2) return null
  const max = Math.max(...data, 1)
  const step = width / (data.length - 1)
  const points = data.map((v, i) => `${i * step},${height - (v / max) * height * 0.85}`).join(' ')

  return (
    <svg width={width} height={height} className="sparkline" aria-hidden="true">
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
