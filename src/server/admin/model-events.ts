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
