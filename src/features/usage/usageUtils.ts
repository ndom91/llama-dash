import type { ApiUsageDay, UsagePeriodDays } from '../../lib/api'
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

export type UsageChartMode = 'all' | 'generated'

export type UsageChartBar = {
  day: string
  /** Bar segment heights as a fraction (0..1) of the axis max. */
  generated: number
  prompt: number
}

export type NiceScale = {
  /** Axis max: `max` rounded up to a whole multiple of `step`. */
  max: number
  step: number
  ticks: number[]
}

const NICE_FACTORS = [1, 2, 2.5, 5]
const MAX_INTERVALS = 5
/** Smallest axis for empty or tiny data, so a few tokens don't fill the chart. */
const MIN_AXIS_MAX = 4

/**
 * "Nice numbers" axis for token counts: the smallest step from
 * {1, 2, 2.5, 5} × 10^n (whole tokens only) that covers `max` in at most five
 * intervals. Adjacent steps differ by at most 2.5×, so this lands on 3–5
 * intervals.
 */
export function niceScale(max: number): NiceScale {
  const target = Math.max(max, MIN_AXIS_MAX)
  let exponent = Math.max(0, Math.floor(Math.log10(target / MAX_INTERVALS)) - 1)
  for (;;) {
    for (const factor of NICE_FACTORS) {
      const step = factor * 10 ** exponent
      if (!Number.isInteger(step)) continue
      const intervals = Math.ceil(target / step)
      if (intervals <= MAX_INTERVALS) {
        return { max: intervals * step, step, ticks: Array.from({ length: intervals + 1 }, (_, i) => i * step) }
      }
    }
    exponent++
  }
}

const AXIS_UNITS: ReadonlyArray<[number, string]> = [
  [1e9, 'b'],
  [1e6, 'm'],
  [1e3, 'k'],
]

/** Axis label: `250k`, `1.5m`, `2m`, `15`. */
export function formatAxisTokens(value: number): string {
  for (const [size, suffix] of AXIS_UNITS) {
    if (Math.abs(value) >= size) return `${Number((value / size).toFixed(2))}${suffix}`
  }
  return String(value)
}

/**
 * Scales the per-day series for the chart against a nice axis. `all` stacks
 * prompt on generated; `generated` drops prompt tokens and scales to the
 * largest generated day so small generated counts stay readable.
 */
export function usageChartBars(
  daily: ReadonlyArray<ApiUsageDay>,
  mode: UsageChartMode,
): { scale: NiceScale; bars: UsageChartBar[] } {
  const value = (d: ApiUsageDay) => (mode === 'generated' ? d.completionTokens : d.completionTokens + d.promptTokens)
  const scale = niceScale(Math.max(0, ...daily.map(value)))
  const bars = daily.map((d) => ({
    day: d.day,
    generated: d.completionTokens / scale.max,
    prompt: mode === 'all' ? d.promptTokens / scale.max : 0,
  }))
  return { scale, bars }
}
