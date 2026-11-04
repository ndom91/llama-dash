import { SYSTEM_TELEMETRY_RANGE_MS, type ApiSystemTelemetry, type SystemTelemetryRange } from '../../lib/schemas/system'
import type { ChartBand } from './TimeSeriesChart'

// The model watcher polls every 15 s, so a load happened somewhere in the 15 s before it was seen.
const MODEL_WATCH_INTERVAL_MS = 15_000

function formatOffset(ms: number): string {
  const minutes = Math.round(ms / 60_000)
  return minutes >= 60 ? `-${Math.round(minutes / 60)}h` : `-${minutes}m`
}

export function rangeXLabels(range: SystemTelemetryRange): Array<string> {
  const span = SYSTEM_TELEMETRY_RANGE_MS[range]
  return [formatOffset(span), formatOffset((span * 2) / 3), formatOffset(span / 3), 'now']
}

export function swapBands(swaps: ApiSystemTelemetry['swaps']): Array<ChartBand> {
  return swaps
    .filter((swap) => swap.event === 'load')
    .map((swap) => ({ start: swap.t - MODEL_WATCH_INTERVAL_MS, end: swap.t, label: `${swap.modelId} loaded` }))
}
