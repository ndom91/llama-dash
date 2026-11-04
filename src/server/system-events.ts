import type { SystemEvent } from '../lib/schemas/system.ts'
import { breachedThresholds, type ThresholdMetric, type ThresholdReadings } from '../lib/schemas/system-thresholds.ts'
import { getSystemThresholds } from './admin/settings.ts'

const MAX_EVENTS = 200

const events: Array<SystemEvent> = []
let activeBreaches = new Set<ThresholdMetric>()
let lastDropped = 0

const METRIC_LABELS: Record<ThresholdMetric, { label: string; unit: string }> = {
  gpuTempC: { label: 'gpu temp', unit: '°C' },
  gpuMemPercent: { label: 'gpu memory', unit: '%' },
  ramPercent: { label: 'system ram', unit: '%' },
  cpuPercent: { label: 'cpu (5m avg)', unit: '%' },
  queueDropped: { label: 'log queue dropped', unit: '' },
}

export function recordSystemEvent(event: Omit<SystemEvent, 't'> & { t?: number }) {
  events.push({ ...event, t: event.t ?? Date.now() })
  if (events.length > MAX_EVENTS) events.splice(0, events.length - MAX_EVENTS)
}

export function getSystemEvents(sinceMs: number): Array<SystemEvent> {
  return events.filter((event) => event.t >= sinceMs)
}

/** Logs a warning when a metric starts breaching its threshold and an ok event when it recovers. */
export function evaluateThresholdEvents(readings: ThresholdReadings) {
  const thresholds = getSystemThresholds()
  const breached = breachedThresholds(readings, thresholds)
  for (const metric of breached) {
    if (activeBreaches.has(metric)) continue
    const { label, unit } = METRIC_LABELS[metric]
    const reading = Math.round(readings[metric] ?? 0)
    recordSystemEvent({
      kind: 'threshold',
      tone: 'warn',
      message: `${label} ${reading}${unit} · above ${thresholds[metric]}${unit} threshold`,
    })
  }
  for (const metric of activeBreaches) {
    if (breached.has(metric)) continue
    recordSystemEvent({ kind: 'threshold', tone: 'ok', message: `${METRIC_LABELS[metric].label} back under threshold` })
  }
  activeBreaches = breached
}

/** The queue counter is cumulative; log each increase as one event. */
export function evaluateQueueDrops(dropped: number) {
  if (dropped > lastDropped) {
    recordSystemEvent({ kind: 'queue', tone: 'err', message: `log queue dropped ${dropped - lastDropped} rows` })
  }
  lastDropped = dropped
}
