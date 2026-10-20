import type { UsagePeriodDays } from '../../lib/api'
import { USAGE_PERIODS } from '../../lib/schemas/usage'

export type UsageDelta =
  | { kind: 'none' }
  | { kind: 'new' }
  | { kind: 'change'; percent: number; direction: 'up' | 'down' | 'flat' }

/** Period-over-period change; `none` when both are zero, `new` when only the current period has usage. */
export function usageDelta(current: number, previous: number): UsageDelta {
  if (previous <= 0) return current > 0 ? { kind: 'new' } : { kind: 'none' }
  const percent = ((current - previous) / previous) * 100
  const rounded = Math.round(Math.abs(percent))
  return { kind: 'change', percent: rounded, direction: rounded === 0 ? 'flat' : percent > 0 ? 'up' : 'down' }
}

const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 })

/** Token counts: exact below 10k, compact above ("12.4k", "3.1m"). */
export function formatTokens(value: number): string {
  if (value < 10_000) return value.toLocaleString('en')
  return compact.format(value).toLowerCase()
}

export function formatShare(part: number, total: number): string {
  if (total <= 0) return '0%'
  const pct = (part / total) * 100
  if (pct > 0 && pct < 1) return '<1%'
  return `${Math.round(pct)}%`
}

/** `2026-03-10` → `Mar 10` (the day is UTC, so format it as UTC). */
export function formatUsageDay(day: string, options: Intl.DateTimeFormatOptions = {}): string {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString('en', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
    ...options,
  })
}

export function parseUsagePeriod(value: unknown): UsagePeriodDays | undefined {
  const n = Number(value)
  return USAGE_PERIODS.find((days) => days === n)
}
