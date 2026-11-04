import * as v from 'valibot'

const Percent = v.pipe(v.number(), v.minValue(1), v.maxValue(100))

export const SystemThresholdsSchema = v.object({
  gpuTempC: v.pipe(v.number(), v.minValue(30), v.maxValue(120)),
  gpuMemPercent: Percent,
  ramPercent: Percent,
  /** Compared against mean CPU utilization over the last 5 minutes. */
  cpuPercent: Percent,
  /** Dropped log rows above this count mark the queue unhealthy. */
  queueDropped: v.pipe(v.number(), v.integer(), v.minValue(0)),
})

export type SystemThresholds = v.InferOutput<typeof SystemThresholdsSchema>

export const UpdateSystemThresholdsBodySchema = v.partial(SystemThresholdsSchema)

export type UpdateSystemThresholdsBody = v.InferOutput<typeof UpdateSystemThresholdsBodySchema>

export const DEFAULT_SYSTEM_THRESHOLDS: SystemThresholds = {
  gpuTempC: 90,
  gpuMemPercent: 90,
  ramPercent: 85,
  cpuPercent: 80,
  queueDropped: 0,
}

/** Parses the stored `system_thresholds` setting; invalid or missing fields fall back to defaults. */
export function parseSystemThresholdsSetting(raw: string | null): SystemThresholds {
  if (raw == null) return { ...DEFAULT_SYSTEM_THRESHOLDS }
  try {
    const result = v.safeParse(UpdateSystemThresholdsBodySchema, JSON.parse(raw))
    return result.success ? { ...DEFAULT_SYSTEM_THRESHOLDS, ...result.output } : { ...DEFAULT_SYSTEM_THRESHOLDS }
  } catch {
    return { ...DEFAULT_SYSTEM_THRESHOLDS }
  }
}

/** Window for the `cpuPercent` reading. */
export const CPU_THRESHOLD_WINDOW_MS = 5 * 60_000

export function percentOf(used: number | null | undefined, total: number | null | undefined): number | null {
  return used == null || total == null || total <= 0 ? null : (used / total) * 100
}

export type ThresholdMetric = keyof SystemThresholds

export type ThresholdReadings = Partial<Record<ThresholdMetric, number | null>>

/** Metrics whose current reading breaches its threshold. Unknown readings never breach. */
export function breachedThresholds(readings: ThresholdReadings, thresholds: SystemThresholds): Set<ThresholdMetric> {
  const breached = new Set<ThresholdMetric>()
  for (const metric of Object.keys(thresholds) as Array<ThresholdMetric>) {
    const reading = readings[metric]
    if (reading == null) continue
    // Queue drops are a count where the threshold is the allowed maximum; the rest are ceilings.
    const isBreach = metric === 'queueDropped' ? reading > thresholds[metric] : reading >= thresholds[metric]
    if (isBreach) breached.add(metric)
  }
  return breached
}
