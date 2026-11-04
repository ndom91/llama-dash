import type { ApiSystemStatus, ApiSystemTelemetry, SystemTelemetrySeries } from '../../lib/schemas/system'
import { breachedThresholds, type SystemThresholds, type ThresholdMetric } from '../../lib/schemas/system-thresholds'

export type Tone = 'ok' | 'warn' | 'err' | 'idle'

const GIB = 1024 ** 3
const CPU_THRESHOLD_WINDOW_MS = 5 * 60_000

export function formatGiB(bytes: number, digits = 1): string {
  return (bytes / GIB).toFixed(digits)
}

export function mibToBytes(mib: number): number {
  return mib * 1024 * 1024
}

export function formatBytesShort(bytes: number): string {
  if (bytes >= GIB) return `${formatGiB(bytes)} GiB`
  if (bytes >= 1024 ** 2) return `${Math.round(bytes / 1024 ** 2)} MB`
  return `${Math.round(bytes / 1024)} KB`
}

export function formatAge(ms: number | null): string {
  if (ms == null) return 'never'
  if (ms < 1_000) return 'now'
  if (ms < 60_000) return `${Math.round(ms / 1_000)}s ago`
  return `${Math.round(ms / 60_000)}m ago`
}

export function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86_400)
  const hours = Math.floor((seconds % 86_400) / 3_600)
  const minutes = Math.floor((seconds % 3_600) / 60)
  if (days === 0 && hours === 0 && minutes === 0) return `${Math.max(1, Math.floor(seconds))}s`
  return [days > 0 ? `${days}d` : null, hours > 0 || days > 0 ? `${hours}h` : null, `${minutes}m`]
    .filter(Boolean)
    .join(' ')
}

export function formatClock(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
}

export function percentOf(used: number | null | undefined, total: number | null | undefined): number | null {
  return used == null || total == null || total <= 0 ? null : (used / total) * 100
}

export function lastValue(values: Array<number | null>): number | null {
  for (let i = values.length - 1; i >= 0; i--) if (values[i] != null) return values[i]
  return null
}

export function peak(series: SystemTelemetrySeries, field: Exclude<keyof SystemTelemetrySeries, 't'>) {
  let best: { value: number; t: number } | null = null
  series[field].forEach((value, i) => {
    if (value != null && (best == null || value > best.value)) best = { value, t: series.t[i] }
  })
  return best as { value: number; t: number } | null
}

function meanSince(series: SystemTelemetrySeries, field: 'cpu', sinceMs: number): number | null {
  const values = series[field].filter((value, i): value is number => value != null && series.t[i] >= sinceMs)
  return values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length
}

export type SystemReadings = Record<ThresholdMetric, number | null>

/** Current values compared against thresholds; shared by tiles, the components rail and events. */
export function systemReadings(status: ApiSystemStatus, telemetry: ApiSystemTelemetry | undefined): SystemReadings {
  const gpu = status.gpu.available ? (status.gpu.gpus[0] ?? null) : null
  const latest = telemetry?.latest ?? null
  const now = latest?.timestamp ?? Date.now()
  return {
    gpuTempC: gpu?.temperatureC ?? null,
    gpuMemPercent: percentOf(gpu?.memoryUsedMiB, gpu?.memoryTotalMiB),
    ramPercent: latest ? percentOf(latest.memUsedBytes, latest.memTotalBytes) : null,
    cpuPercent: telemetry ? meanSince(telemetry.series, 'cpu', now - CPU_THRESHOLD_WINDOW_MS) : null,
    queueDropped: status.logging.dropped,
  }
}

export function breachTone(metric: ThresholdMetric, breached: Set<ThresholdMetric>): Tone {
  if (!breached.has(metric)) return 'ok'
  return metric === 'queueDropped' ? 'err' : 'warn'
}

export function evaluateBreaches(readings: SystemReadings, thresholds: SystemThresholds | undefined) {
  return thresholds ? breachedThresholds(readings, thresholds) : new Set<ThresholdMetric>()
}
