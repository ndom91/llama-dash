export const TELEMETRY_FIELDS = [
  'gpuUtil',
  'gpuTemp',
  'gpuPower',
  'gpuMemUsedMiB',
  'gpuMemTotalMiB',
  'cpu',
  'memUsedMiB',
  'memTotalMiB',
  'swapUsedMiB',
  'load1',
] as const

export type TelemetryField = (typeof TELEMETRY_FIELDS)[number]
export type TelemetryValues = Partial<Record<TelemetryField, number | null>>
export type TelemetrySeries = { t: Array<number> } & Record<TelemetryField, Array<number | null>>

// Peaks matter more than averages for heat and power, so downsampling keeps the max.
const MAX_FIELDS = new Set<TelemetryField>(['gpuTemp', 'gpuPower'])

/** Fixed-size columnar ring. Missing values are stored as NaN and read back as null. */
export class TelemetryRing {
  readonly capacity: number
  private readonly timestamps: Float64Array
  private readonly columns: Record<TelemetryField, Float32Array>
  private head = 0
  private size = 0

  constructor(capacity: number) {
    this.capacity = capacity
    this.timestamps = new Float64Array(capacity)
    this.columns = Object.fromEntries(
      TELEMETRY_FIELDS.map((field) => [field, new Float32Array(capacity).fill(Number.NaN)]),
    ) as Record<TelemetryField, Float32Array>
  }

  get length() {
    return this.size
  }

  get lastTimestamp(): number | null {
    return this.size === 0 ? null : this.timestamps[(this.head - 1 + this.capacity) % this.capacity]
  }

  push(timestamp: number, values: TelemetryValues) {
    const slot = this.head
    this.timestamps[slot] = timestamp
    for (const field of TELEMETRY_FIELDS) {
      const value = values[field]
      this.columns[field][slot] = value == null || !Number.isFinite(value) ? Number.NaN : value
    }
    this.head = (this.head + 1) % this.capacity
    this.size = Math.min(this.size + 1, this.capacity)
  }

  /** Newest non-missing value of `field` recorded at or before `atMs`. */
  valueAtOrBefore(field: TelemetryField, atMs: number): number | null {
    for (let i = 1; i <= this.size; i++) {
      const slot = (this.head - i + this.capacity) % this.capacity
      if (this.timestamps[slot] > atMs) continue
      const value = this.columns[field][slot]
      if (!Number.isNaN(value)) return value
    }
    return null
  }

  /** Samples with timestamp >= sinceMs, oldest first, bucketed down to at most maxPoints. */
  read(sinceMs: number, maxPoints: number): TelemetrySeries {
    const start = (this.head - this.size + this.capacity) % this.capacity
    const slots: Array<number> = []
    for (let i = 0; i < this.size; i++) {
      const slot = (start + i) % this.capacity
      if (this.timestamps[slot] >= sinceMs) slots.push(slot)
    }

    const bucketSize = Math.max(1, Math.ceil(slots.length / Math.max(1, maxPoints)))
    const series = { t: [] as Array<number> } as TelemetrySeries
    for (const field of TELEMETRY_FIELDS) series[field] = []

    for (let i = 0; i < slots.length; i += bucketSize) {
      const bucket = slots.slice(i, i + bucketSize)
      series.t.push(this.timestamps[bucket[bucket.length - 1]])
      for (const field of TELEMETRY_FIELDS) {
        series[field].push(aggregate(this.columns[field], bucket, MAX_FIELDS.has(field)))
      }
    }
    return series
  }
}

function aggregate(column: Float32Array, slots: Array<number>, useMax: boolean): number | null {
  let sum = 0
  let max = Number.NEGATIVE_INFINITY
  let count = 0
  for (const slot of slots) {
    const value = column[slot]
    if (Number.isNaN(value)) continue
    sum += value
    max = Math.max(max, value)
    count++
  }
  if (count === 0) return null
  return Math.round((useMax ? max : sum / count) * 10) / 10
}
