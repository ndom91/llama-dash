export function formatMiBGb(value: number | null | undefined) {
  if (value == null) return '—'
  return (value / 1024).toFixed(1)
}

export function formatLatency(ms: number): string {
  if (ms < 1000) return `${ms}`
  return (ms / 1000).toFixed(2)
}
