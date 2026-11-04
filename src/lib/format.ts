const compactNumberFormatter = new Intl.NumberFormat('en', {
  maximumFractionDigits: 0,
  notation: 'compact',
})

// Below 1000 keep raw locale formatting; >= 1000 use compact form ("2K", "1.2M").
export function formatCompactNumber(value: number | null | undefined): string {
  if (value == null) return '—'
  if (value < 1000) return value.toLocaleString()
  return compactNumberFormatter.format(value).toLowerCase()
}

export function formatVersionLabel(value: string | null | undefined): string {
  if (!value) return '—'
  return /^v/i.test(value) ? value : `v${value}`
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  const s = ms / 1000
  if (s < 60) return `${s.toFixed(s < 10 ? 2 : 1)}s`
  const m = Math.floor(s / 60)
  const rem = Math.floor(s % 60)
  return `${m}m ${rem}s`
}

export function formatRate(v: number): string {
  if (v === 0) return '0.0'
  if (v < 0.1) return v.toFixed(2)
  return v.toFixed(1)
}
