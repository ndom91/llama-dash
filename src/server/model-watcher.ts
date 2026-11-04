import { desc } from 'drizzle-orm'
import { ulid } from 'ulidx'
import { db, schema } from './db/index.ts'
import { inferenceBackend } from './inference/backend.ts'
import { publishAdminEvent } from './admin/events.ts'
import { scheduleFootprintMeasurement } from './model-footprints.ts'

const POLL_INTERVAL_MS = 15_000

let knownRunning = new Set<string>()
let started = false
let lastPollAt: number | null = null

function seedFromDb() {
  const rows = db
    .select({ modelId: schema.modelEvents.modelId, event: schema.modelEvents.event })
    .from(schema.modelEvents)
    .orderBy(desc(schema.modelEvents.timestamp))
    .all()
  const seen = new Set<string>()
  for (const r of rows) {
    if (seen.has(r.modelId)) continue
    seen.add(r.modelId)
    if (r.event === 'load') knownRunning.add(r.modelId)
  }
}

async function diffRunning() {
  if (!inferenceBackend.listRunning) return

  try {
    const running = await inferenceBackend.listRunning()
    const current = new Set(running.map((r) => r.model))

    const now = new Date()
    const inserts: Array<typeof schema.modelEvents.$inferInsert> = []

    for (const id of current) {
      if (!knownRunning.has(id)) {
        inserts.push({ id: `mev_${ulid()}`, modelId: id, event: 'load', timestamp: now })
      }
    }
    for (const id of knownRunning) {
      if (!current.has(id)) {
        inserts.push({ id: `mev_${ulid()}`, modelId: id, event: 'unload', timestamp: now })
      }
    }

    if (inserts.length > 0) {
      for (const row of inserts) {
        db.insert(schema.modelEvents).values(row).run()
      }
      publishAdminEvent('model.changed', { events: inserts.map((row) => ({ modelId: row.modelId, event: row.event })) })
      // A lone load is the only case where memory growth is attributable to one model.
      if (inserts.length === 1 && inserts[0].event === 'load' && lastPollAt != null) {
        scheduleFootprintMeasurement(inserts[0].modelId, lastPollAt)
      }
    }

    knownRunning = current
    lastPollAt = now.getTime()
  } catch {
    // upstream unreachable — keep last known state
  }
}

export function startModelWatcher() {
  if (started) return
  started = true

  seedFromDb()
  diffRunning()
  setInterval(diffRunning, POLL_INTERVAL_MS)
}
