import { describe, expect, it } from 'vitest'
import { analyzeTiming, formatPhaseMs, parseSseStream } from './requestDetailUtils.ts'

describe('analyzeTiming', () => {
  it('prefers persisted display phases when present', () => {
    const timing = analyzeTiming({
      queueMs: 10,
      modelLoadingMs: 40,
      prefillMs: 95,
      reasoningMs: 50,
      responseMs: 130,
      gpuPrefillMs: 95,
      gpuDecodeMs: 180,
    })
    expect(timing.queueMs).toBe(10)
    expect(timing.modelLoadingMs).toBe(40)
    expect(timing.prefillMs).toBe(95)
    expect(timing.reasoningMs).toBe(50)
    expect(timing.responseMs).toBe(130)
  })

  it('scrapes GPU timings from SSE for legacy rows and maps them to display phases', () => {
    const sse = parseSseStream(
      [
        'data: {"choices":[{"delta":{"content":"hi"}}]}',
        '',
        'data: {"timings":{"prompt_ms":110,"predicted_ms":220}}',
        '',
        'data: [DONE]',
        '',
      ].join('\n'),
    )
    const timing = analyzeTiming({
      sse,
      queueMs: 90,
      prefillMs: 50,
      decodeMs: 80,
      streamCloseMs: 5,
    })
    expect(timing.queueMs).toBe(90)
    expect(timing.prefillMs).toBe(110)
    expect(timing.responseMs).toBe(220)
    expect(timing.modelLoadingMs).toBeNull()
    expect(timing.reasoningMs).toBeNull()
  })

  it('keeps persisted GPU-backed prefill when equal to gpuPrefillMs', () => {
    const timing = analyzeTiming({
      queueMs: 5,
      prefillMs: 12,
      responseMs: 34,
      gpuPrefillMs: 12,
      gpuDecodeMs: 34,
    })
    expect(timing.prefillMs).toBe(12)
    expect(timing.responseMs).toBe(34)
  })
})

describe('formatPhaseMs', () => {
  it('shows em dash for null or zero', () => {
    expect(formatPhaseMs(null)).toBe('—')
    expect(formatPhaseMs(0)).toBe('—')
    expect(formatPhaseMs(12)).toBe('12.0 ms')
  })
})
