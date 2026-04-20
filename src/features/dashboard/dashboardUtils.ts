import type { ApiModelEvent } from '../../lib/api'

export type ResidencySpan = {
  modelId: string
  start: number
  end: number
}

export const DASHBOARD_WINDOW_MS = 60 * 60_000

export function buildResidencySpans(events: Array<ApiModelEvent>, now: number): Array<ResidencySpan> {
  const windowStart = now - DASHBOARD_WINDOW_MS
  const active = new Map<string, number>()
  const spans: Array<ResidencySpan> = []

  for (const ev of events) {
    const ts = new Date(ev.timestamp).getTime()
    if (ev.event === 'load') {
      active.set(ev.modelId, ts)
      continue
    }
    const loadTs = active.get(ev.modelId)
    if (loadTs != null) {
      spans.push({ modelId: ev.modelId, start: Math.max(loadTs, windowStart), end: ts })
      active.delete(ev.modelId)
    }
  }

  for (const [modelId, start] of active) {
    spans.push({ modelId, start: Math.max(start, windowStart), end: now })
  }

  return spans
}

export function formatMiBGb(value: number | null | undefined) {
  if (value == null) return '—'
  return (value / 1024).toFixed(1)
}

export function formatDurationMinutes(ms: number) {
  if (ms <= 0) return '0m'
  const mins = Math.round(ms / 60_000)
  return `${mins}m`
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
