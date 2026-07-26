import { vi } from 'vitest'

/**
 * Integration project setup. Vitest `test.env` sets DATABASE_PATH=:memory: before
 * this file loads; reinforce the critical vars so config/db singletons stay isolated
 * from the developer's local .env.
 *
 * Mock undici here (before harness imports that transitively load forward.ts) so the
 * proxy forward path never hits the real network.
 */
process.env.DATABASE_PATH = process.env.DATABASE_PATH || ':memory:'
process.env.INFERENCE_BASE_URL = process.env.INFERENCE_BASE_URL || 'http://llama-swap.test'
process.env.CREDENTIAL_ENCRYPTION_KEY =
  process.env.CREDENTIAL_ENCRYPTION_KEY || 'test-credential-encryption-key-32chars'
process.env.LOCAL_BACKEND_MAX_CONCURRENT = process.env.LOCAL_BACKEND_MAX_CONCURRENT || '8'
process.env.LOCAL_BACKEND_MODEL_GROUPING = process.env.LOCAL_BACKEND_MODEL_GROUPING || 'false'
process.env.MODEL_QUEUE_BATCH_WINDOW_MS = process.env.MODEL_QUEUE_BATCH_WINDOW_MS || '0'

vi.mock('undici', async (importOriginal) => {
  const actual = await importOriginal<typeof import('undici')>()
  const { undiciFetchMock } = await import('./harness/undici-mock-state.ts')
  return { ...actual, fetch: undiciFetchMock }
})

const { ensureTestDatabase } = await import('./harness/db.ts')
ensureTestDatabase()
