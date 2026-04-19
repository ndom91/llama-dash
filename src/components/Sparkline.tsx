let nextId = 0

function smoothPath(pts: Array<{ x: number; y: number }>, tension = 0.6): string {
  if (pts.length < 2) return ''
  let d = `M${pts[0].x},${pts[0].y}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[Math.min(pts.length - 1, i + 2)]
    const minY = Math.min(p1.y, p2.y)
    const maxY = Math.max(p1.y, p2.y)
    const cp1x = p1.x + ((p2.x - p0.x) * tension) / 3
    const cp1y = Math.min(maxY, Math.max(minY, p1.y + ((p2.y - p0.y) * tension) / 3))
    const cp2x = p2.x - ((p3.x - p1.x) * tension) / 3
    const cp2y = Math.min(maxY, Math.max(minY, p2.y - ((p3.y - p1.y) * tension) / 3))
    d += ` C${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`
  }
  return d
}

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
  const linePath = smoothPath(coords)
  const glowCoords = coords.map((p) => ({ x: p.x, y: Math.max(0, p.y - glowH) }))
  const glowPath = `${smoothPath(coords)} L${coords[coords.length - 1].x},${glowCoords[glowCoords.length - 1].y} ${smoothPath(glowCoords.slice().reverse()).replace('M', 'L')} Z`

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
      <path d={glowPath} fill={`url(#${id}-glow)`} />
      <path d={linePath} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
