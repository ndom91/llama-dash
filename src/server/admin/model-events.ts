import { and, desc, gte, notInArray } from 'drizzle-orm'
import { db, schema } from '../db/index.ts'

export function getModelTimeline(windowMs = 30 * 60_000) {
  const since = new Date(Date.now() - windowMs)

  const inWindow = db
    .select()
    .from(schema.modelEvents)
    .where(gte(schema.modelEvents.timestamp, since))
    .orderBy(schema.modelEvents.timestamp)
    .all()

  const modelsInWindow = new Set(inWindow.map((e) => e.modelId))

  const olderLoads = db
    .select()
    .from(schema.modelEvents)
    .where(modelsInWindow.size > 0 ? and(notInArray(schema.modelEvents.modelId, [...modelsInWindow])) : undefined)
    .orderBy(desc(schema.modelEvents.timestamp))
    .all()

  const latestPerModel = new Map<string, (typeof olderLoads)[number]>()
  for (const e of olderLoads) {
    if (!latestPerModel.has(e.modelId)) latestPerModel.set(e.modelId, e)
  }
  const stillLoaded = [...latestPerModel.values()].filter((e) => e.event === 'load')

  return [...stillLoaded, ...inWindow].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
}
