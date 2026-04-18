import { ulid } from 'ulidx'
import { db, schema } from './db/index.ts'
import { llamaSwap } from './llama-swap/client.ts'

const POLL_INTERVAL_MS = 15_000

let knownRunning = new Set<string>()
let started = false
let pollTimer: ReturnType<typeof setInterval> | null = null

async function diffRunning() {
  try {
    const { running } = await llamaSwap.listRunning()
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
    }

    knownRunning = current
  } catch {
    // upstream unreachable — keep last known state
  }
}

export function startModelWatcher() {
  if (started) return
  started = true

  diffRunning()
  pollTimer = setInterval(diffRunning, POLL_INTERVAL_MS)
}

export function stopModelWatcher() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
  started = false
}
