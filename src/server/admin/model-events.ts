import { gte } from 'drizzle-orm'
import { db, schema, sqliteDb } from '../db/index.ts'

export function getModelTimeline(windowMs = 30 * 60_000) {
  const since = new Date(Date.now() - windowMs)

  const inWindow = db
    .select()
    .from(schema.modelEvents)
    .where(gte(schema.modelEvents.timestamp, since))
    .orderBy(schema.modelEvents.timestamp)
    .all()

  const modelsInWindow = new Set(inWindow.map((e) => e.modelId))

  // Latest pre-window event per model tells the timeline which models were
  // already loaded before the visible window began.
  const olderLoads = sqliteDb
    .prepare(
      `select me.id, me.model_id as modelId, me.event, me.timestamp
      from model_events me
      inner join (
        select model_id, max(timestamp) as timestamp
        from model_events
        where timestamp < ?
        group by model_id
      ) latest on latest.model_id = me.model_id and latest.timestamp = me.timestamp
      where me.event = 'load'`,
    )
    .all(since.getTime()) as Array<{ id: string; modelId: string; event: 'load'; timestamp: number }>

  const stillLoaded = olderLoads
    .filter((e) => !modelsInWindow.has(e.modelId))
    .map((e) => ({ ...e, timestamp: new Date(e.timestamp) }))

  return [...stillLoaded, ...inWindow].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
}

/** Ticks per window. 1h → 15s buckets, 24h → 6min buckets. */
export const MODEL_ACTIVITY_BUCKETS = 240

/**
 * Per-model inference request activity over the window, bucketed so the
 * payload stays bounded regardless of traffic. Drives the request ticks on
 * the dashboard's model residency tracks.
 */
export function getModelActivity(windowMs: number, now = Date.now()) {
  const bucketMs = Math.max(1000, Math.ceil(windowMs / MODEL_ACTIVITY_BUCKETS))
  // Align the window to bucket boundaries so ticks don't shuffle between
  // neighbouring buckets on every refetch.
  const end = Math.ceil(now / bucketMs) * bucketMs
  const since = end - bucketMs * MODEL_ACTIVITY_BUCKETS

  const rows = sqliteDb
    .prepare(
      `select model,
        cast((started_at - ?) / ? as integer) as bucket,
        count(*) as count,
        sum(case when status_code >= 400 then 1 else 0 end) as errors,
        max(started_at) as lastAt
      from requests
      where request_class = 'inference' and started_at >= ? and model is not null
      group by model, bucket
      order by model, bucket`,
    )
    .all(since, bucketMs, since) as Array<{
    model: string
    bucket: number
    count: number
    errors: number
    lastAt: number
  }>

  const byModel = new Map<
    string,
    {
      model: string
      total: number
      errors: number
      lastAt: number | null
      ticks: Array<{ bucket: number; count: number; errors: number }>
    }
  >()
  for (const row of rows) {
    let entry = byModel.get(row.model)
    if (!entry) {
      entry = { model: row.model, total: 0, errors: 0, lastAt: null, ticks: [] }
      byModel.set(row.model, entry)
    }
    entry.total += row.count
    entry.errors += row.errors
    entry.lastAt = Math.max(entry.lastAt ?? 0, row.lastAt)
    entry.ticks.push({ bucket: Math.min(row.bucket, MODEL_ACTIVITY_BUCKETS - 1), count: row.count, errors: row.errors })
  }

  return { windowMs: bucketMs * MODEL_ACTIVITY_BUCKETS, bucketMs, since, models: [...byModel.values()] }
}
