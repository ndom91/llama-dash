export function formatMiBGb(value: number | null | undefined) {
  if (value == null) return '—'
  return (value / 1024).toFixed(1)
}

export function formatLatency(ms: number): string {
  if (ms < 1000) return `${ms}`
  return (ms / 1000).toFixed(2)
}

export function formatRate(v: number): string {
  if (v === 0) return '0.0'
  if (v < 0.1) return v.toFixed(2)
  return v.toFixed(1)
}
