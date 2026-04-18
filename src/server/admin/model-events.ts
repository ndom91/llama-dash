import { gte } from 'drizzle-orm'
import { db, schema } from '../db/index.ts'

export function getModelTimeline(windowMs = 30 * 60_000) {
  const since = new Date(Date.now() - windowMs)
  return db
    .select()
    .from(schema.modelEvents)
    .where(gte(schema.modelEvents.timestamp, since))
    .orderBy(schema.modelEvents.timestamp)
    .all()
}
