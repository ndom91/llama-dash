import { eq } from 'drizzle-orm'
import { ulid } from 'ulidx'
import type { ApiModelSpecs } from '../lib/schemas/model'
import { db, schema } from './db/index.ts'
import { inferenceBackend } from './inference/backend.ts'
import type { BackendRunningModel } from './inference/backend.ts'

// Models whose specs were requested during their current residency, whatever the outcome.
// Cleared on unload so a reload, which may point at a different GGUF, is read again.
const captured = new Set<string>()

/**
 * Reads weights size, parameter count, and quantization for ready models not yet captured.
 * Only running models are queried: asking llama-swap about a stopped model would start it.
 */
export function captureModelSpecs(running: Array<BackendRunningModel>) {
  const fetchSpecs = inferenceBackend.modelSpecs
  if (!fetchSpecs) return
  const runningIds = new Set(running.map((model) => model.model))
  for (const id of captured) {
    if (!runningIds.has(id)) captured.delete(id)
  }
  for (const model of running) {
    const id = model.model
    if (model.state !== 'ready' || captured.has(id)) continue
    captured.add(id)
    fetchSpecs(id)
      .then((specs) => {
        if (!specs) return
        const capturedAt = new Date()
        db.insert(schema.modelSpecs)
          .values({ id: `msp_${ulid()}`, modelId: id, ...specs, capturedAt })
          .onConflictDoUpdate({ target: schema.modelSpecs.modelId, set: { ...specs, capturedAt } })
          .run()
      })
      .catch(() => {
        // Best effort: the previous row stays in place. Not retrying until the next load keeps
        // upstreams that are not llama-server from being probed on every poll.
      })
  }
}

export function getModelSpecs(modelId: string): ApiModelSpecs | null {
  const row = db
    .select({
      sizeBytes: schema.modelSpecs.sizeBytes,
      paramCount: schema.modelSpecs.paramCount,
      quantization: schema.modelSpecs.quantization,
    })
    .from(schema.modelSpecs)
    .where(eq(schema.modelSpecs.modelId, modelId))
    .get()
  return row ?? null
}
