import type { QueryClient } from '@tanstack/react-query'
import type * as v from 'valibot'
import { qk } from './query-keys'
import {
  type ApiSystemTelemetry,
  isLiveAppendRange,
  SYSTEM_TELEMETRY_RANGE_MS,
  type SystemTelemetryEventSchema,
  type SystemTelemetrySeries,
} from './schemas/system'

type TelemetryEvent = v.InferOutput<typeof SystemTelemetryEventSchema>
type SeriesField = Exclude<keyof SystemTelemetrySeries, 't'>

export function appendSystemTelemetryPoint(queryClient: QueryClient, event: TelemetryEvent) {
  for (const query of queryClient.getQueryCache().findAll({ queryKey: qk.systemTelemetryRoot })) {
    queryClient.setQueryData<ApiSystemTelemetry>(query.queryKey, (old) => {
      if (!old) return old
      if (!isLiveAppendRange(old.range)) return { ...old, latest: event.latest }
      return { ...old, latest: event.latest, series: appendPoint(old.series, event.point, old.range) }
    })
  }
}

function appendPoint(
  series: SystemTelemetrySeries,
  point: TelemetryEvent['point'],
  range: ApiSystemTelemetry['range'],
): SystemTelemetrySeries {
  if (series.t.at(-1) != null && point.t <= series.t.at(-1)!) return series
  const since = point.t - SYSTEM_TELEMETRY_RANGE_MS[range]
  const firstKept = series.t.findIndex((t) => t >= since)
  const start = firstKept === -1 ? series.t.length : firstKept
  const next = { t: [...series.t.slice(start), point.t] } as SystemTelemetrySeries
  for (const field of Object.keys(series) as Array<keyof SystemTelemetrySeries>) {
    if (field === 't') continue
    const key = field as SeriesField
    next[key] = [...series[key].slice(start), point[key] ?? null]
  }
  return next
}
