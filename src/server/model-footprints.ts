import { gt } from 'drizzle-orm'
import { ulid } from 'ulidx'
import { db, schema } from './db/index.ts'
import { getTelemetryRing, TELEMETRY_INTERVAL_MS } from './system-telemetry.ts'

// Two telemetry ticks after detection, so the GPU sample reflects the fully loaded model.
const SETTLE_MS = 2.5 * TELEMETRY_INTERVAL_MS

/** Footprint in MiB, or null when the delta is unusable (missing data or memory went down). */
export function footprintFromDelta(beforeMiB: number | null, afterMiB: number | null): number | null {
  if (beforeMiB == null || afterMiB == null) return null
  const delta = Math.round(afterMiB - beforeMiB)
  return delta > 0 ? delta : null
}

/**
 * Measures accelerator-memory growth around a single model load. `beforeMs` is the last time the
 * model was known not to be running. Any other model event in the window makes the delta ambiguous,
 * so the measurement is skipped.
 */
export function scheduleFootprintMeasurement(modelId: string, beforeMs: number) {
  const ring = getTelemetryRing()
  const beforeMiB = ring.valueAtOrBefore('gpuMemUsedMiB', beforeMs)
  setTimeout(() => {
    try {
      const otherEvents = db
        .select({ id: schema.modelEvents.id })
        .from(schema.modelEvents)
        .where(gt(schema.modelEvents.timestamp, new Date(beforeMs)))
        .all()
      if (otherEvents.length !== 1) return
      const footprintMiB = footprintFromDelta(beforeMiB, ring.valueAtOrBefore('gpuMemUsedMiB', Date.now()))
      if (footprintMiB == null) return
      const measuredAt = new Date()
      db.insert(schema.modelFootprints)
        .values({ id: `mfp_${ulid()}`, modelId, footprintMiB, measuredAt })
        .onConflictDoUpdate({ target: schema.modelFootprints.modelId, set: { footprintMiB, measuredAt } })
        .run()
    } catch {
      // Best effort: a missed measurement only leaves the previous footprint in place.
    }
  }, SETTLE_MS)
}

export function getModelFootprints(): Map<string, number> {
  const rows = db
    .select({ modelId: schema.modelFootprints.modelId, footprintMiB: schema.modelFootprints.footprintMiB })
    .from(schema.modelFootprints)
    .all()
  return new Map(rows.map((row) => [row.modelId, row.footprintMiB]))
}
