import { afterEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ host: vi.fn(), gpu: vi.fn(), publish: vi.fn() }))
vi.mock('./inference/backend.ts', () => ({ inferenceBackend: { hostPerformance: mocks.host } }))
vi.mock('./gpu-poller.ts', () => ({ getGpuSnapshot: mocks.gpu }))
vi.mock('./admin/events.ts', () => ({ publishAdminEvent: mocks.publish }))
vi.mock('./proxy/log.ts', () => ({ getRequestLogQueueStats: () => ({ dropped: 0 }) }))
vi.mock('./system-events.ts', () => ({
  evaluateQueueDrops: vi.fn(),
  evaluateThresholdEvents: vi.fn(),
  recordSystemEvent: vi.fn(),
}))
vi.mock('node:fs/promises', () => ({ readFile: vi.fn().mockResolvedValue('') }))

afterEach(() => {
  vi.clearAllTimers()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

it('skips overlapping ticks and resumes after a failure', async () => {
  vi.useFakeTimers()
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  let finish!: (value: never[]) => void
  mocks.host
    .mockResolvedValueOnce([])
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    .mockResolvedValue([])
  mocks.gpu.mockReturnValue({ available: false, cpuUtilizationPercent: 0 })
  const { startSystemTelemetry } = await import('./system-telemetry')
  startSystemTelemetry('test')
  await vi.advanceTimersByTimeAsync(30_000)
  expect(mocks.host).toHaveBeenCalledTimes(2)
  expect(mocks.publish).not.toHaveBeenCalled()
  finish([])
  await vi.advanceTimersByTimeAsync(0)
  expect(mocks.publish).toHaveBeenCalledTimes(1)
  mocks.gpu.mockImplementationOnce(() => {
    throw new Error('sample failed')
  })
  await vi.advanceTimersByTimeAsync(10_000)
  expect(warn).toHaveBeenCalledWith('Failed to collect system telemetry', expect.any(Error))
  await vi.advanceTimersByTimeAsync(10_000)
  expect(mocks.publish).toHaveBeenCalledTimes(2)
})
