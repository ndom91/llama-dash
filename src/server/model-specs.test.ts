import { beforeEach, expect, it, vi } from 'vitest'
import type { BackendRunningModel } from './inference/backend.ts'

const { modelSpecs, run } = vi.hoisted(() => ({ modelSpecs: vi.fn(), run: vi.fn() }))
vi.mock('./inference/backend.ts', () => ({ inferenceBackend: { modelSpecs } }))
vi.mock('./db/index.ts', () => ({
  db: { insert: () => ({ values: () => ({ onConflictDoUpdate: () => ({ run }) }) }) },
  schema: { modelSpecs: { modelId: {} } },
}))

const specs = { sizeBytes: 1_837_991_168, paramCount: 1_728_801_600, quantization: 'Q8_0' }

function running(model: string, state = 'ready'): BackendRunningModel {
  return { model, state, ttl: null, contextLength: null }
}

async function loadCapture() {
  // `captured` is module state, so each test starts from a fresh module.
  vi.resetModules()
  return (await import('./model-specs.ts')).captureModelSpecs
}

beforeEach(() => {
  modelSpecs.mockReset().mockResolvedValue(specs)
  run.mockReset()
})

it('never queries models that are not ready', async () => {
  const capture = await loadCapture()
  capture([running('a', 'starting'), running('b', 'stopping')])
  expect(modelSpecs).not.toHaveBeenCalled()
})

it('queries a ready model once per residency and stores the result', async () => {
  const capture = await loadCapture()
  capture([running('a')])
  capture([running('a')])
  await vi.waitFor(() => expect(run).toHaveBeenCalledTimes(1))
  expect(modelSpecs).toHaveBeenCalledTimes(1)
  expect(modelSpecs).toHaveBeenCalledWith('a')
})

it('queries again after the model unloads and reloads', async () => {
  const capture = await loadCapture()
  capture([running('a')])
  capture([])
  capture([running('a')])
  expect(modelSpecs).toHaveBeenCalledTimes(2)
})

it('does not retry a failed lookup during the same residency', async () => {
  modelSpecs.mockRejectedValue(new Error('not llama-server'))
  const capture = await loadCapture()
  capture([running('a')])
  await Promise.resolve()
  capture([running('a')])
  expect(modelSpecs).toHaveBeenCalledTimes(1)
  expect(run).not.toHaveBeenCalled()
})
