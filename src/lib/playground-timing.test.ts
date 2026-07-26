import { describe, expect, it } from 'vitest'
import { computePlaygroundEventTiming } from './playground-timing.ts'

describe('computePlaygroundEventTiming', () => {
  it('uses START → END for total duration (not request-sent)', () => {
    const timing = computePlaygroundEventTiming({
      startedAt: 1_000,
      doneAt: 1_500,
      closeAt: 1_600,
      relayedAt: 1_050,
      reasoningStartAt: 0,
      firstContentAt: 1_200,
      wasQueued: false,
      queueMs: 0,
      promptMs: 40,
      predictedMs: 100,
    })
    expect(timing.totalMs).toBe(500)
    expect(timing.queueMs).toBe(0)
    expect(timing.modelLoadingMs).toBe(110) // 150 - 40
    expect(timing.reasoningMs).toBeNull()
    expect(timing.responseMs).toBe(100)
  })

  it('computes queue as RELAY − START when queued', () => {
    const timing = computePlaygroundEventTiming({
      startedAt: 1_000,
      doneAt: 2_000,
      relayedAt: 1_400,
      reasoningStartAt: 1_500,
      firstContentAt: 1_700,
      wasQueued: true,
      queueMs: null,
      promptMs: 20,
      predictedMs: 200,
    })
    expect(timing.queueMs).toBe(400)
    expect(timing.reasoningMs).toBe(200)
    expect(timing.modelLoadingMs).toBe(80) // (1500-1400) - 20? firstToken is reason at 1500, relay 1400 → 100 - 20 = 80
  })

  it('prefers server clocks already stored on RELAY/REASON/RESPOND fields', () => {
    // Values as if RELAY-relative atMs were added to a client RELAY anchor.
    const timing = computePlaygroundEventTiming({
      startedAt: 10,
      doneAt: 1_000,
      relayedAt: 100,
      reasoningStartAt: 180,
      firstContentAt: 280,
      wasQueued: false,
      queueMs: 0,
      promptMs: 30,
      predictedMs: 150,
    })
    expect(timing.modelLoadingMs).toBe(50) // 80 - 30
    expect(timing.reasoningMs).toBe(100)
    expect(timing.responseMs).toBe(50) // 150 - 100
  })
})
