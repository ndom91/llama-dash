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
