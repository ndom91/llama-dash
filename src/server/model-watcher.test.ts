import { afterEach, expect, it, vi } from 'vitest'

const { listRunning } = vi.hoisted(() => ({ listRunning: vi.fn() }))
vi.mock('./inference/backend.ts', () => ({ inferenceBackend: { listRunning } }))
vi.mock('./db/index.ts', () => ({
  db: { select: () => ({ from: () => ({ orderBy: () => ({ all: () => [] }) }) }) },
  schema: { modelEvents: { modelId: {}, event: {}, timestamp: {} } },
}))
vi.mock('./admin/events.ts', () => ({ publishAdminEvent: vi.fn() }))
vi.mock('./model-footprints.ts', () => ({ scheduleFootprintMeasurement: vi.fn() }))

afterEach(() => {
  vi.clearAllTimers()
  vi.useRealTimers()
})

it('does not overlap model polls and resumes after a poll completes', async () => {
  vi.useFakeTimers()
  let finish!: (value: never[]) => void
  listRunning.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve
      }),
  )
  listRunning.mockResolvedValue([])
  const { startModelWatcher } = await import('./model-watcher')
  startModelWatcher()
  await vi.advanceTimersByTimeAsync(45_000)
  expect(listRunning).toHaveBeenCalledTimes(1)
  finish([])
  await vi.advanceTimersByTimeAsync(15_000)
  expect(listRunning).toHaveBeenCalledTimes(2)
})
