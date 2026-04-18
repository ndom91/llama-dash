import { ulid } from 'ulidx'
import { config } from './config.ts'
import { db, schema } from './db/index.ts'
import { llamaSwap } from './llama-swap/client.ts'

const POLL_INTERVAL_MS = 60_000

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

function connectSSE() {
  const url = `${config.llamaSwapUrl}/api/events`
  fetch(url)
    .then(async (res) => {
      if (!res.ok || !res.body) {
        scheduleReconnect()
        return
      }
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        const text = decoder.decode(value, { stream: true })
        if (text.includes('"logData"')) {
          await diffRunning()
        }
      }
      scheduleReconnect()
    })
    .catch(() => {
      scheduleReconnect()
    })
}

function scheduleReconnect() {
  setTimeout(connectSSE, 5_000)
}

export function startModelWatcher() {
  if (started) return
  started = true

  diffRunning()
  connectSSE()
  pollTimer = setInterval(diffRunning, POLL_INTERVAL_MS)
}

export function stopModelWatcher() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
  started = false
}
