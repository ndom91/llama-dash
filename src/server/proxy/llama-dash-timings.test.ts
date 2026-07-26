import { describe, expect, it } from 'vitest'
import {
  attachLlamaDashTimings,
  buildLlamaDashTimings,
  LLAMA_DASH_TIMINGS_KEY,
  readLlamaDashTimings,
} from './llama-dash-timings.ts'

describe('llama-dash-timings', () => {
  it('builds a sibling timings object from queue + usage phases', () => {
    const timings = buildLlamaDashTimings({
      queueMs: 250.7,
      reasonMs: 80,
      respondMs: 180,
      usage: {
        modelLoadingMs: 12,
        prefillMs: 40,
        reasoningMs: 100,
        responseMs: 60,
      },
    })
    expect(timings).toEqual({
      queued: true,
      queue_ms: 251,
      reason_ms: 80,
      respond_ms: 180,
      model_loading_ms: 12,
      prefill_ms: 40,
      reasoning_ms: 100,
      response_ms: 60,
    })
  })

  it('attaches under timings_llama_dash without touching upstream timings', () => {
    const body = attachLlamaDashTimings(
      { model: 'x', timings: { prompt_ms: 1, predicted_ms: 2 } },
      buildLlamaDashTimings({
        queueMs: 0,
        reasonMs: null,
        respondMs: 10,
        usage: {
          modelLoadingMs: null,
          prefillMs: 1,
          reasoningMs: null,
          responseMs: 2,
        },
      }),
    )
    expect(body.timings).toEqual({ prompt_ms: 1, predicted_ms: 2 })
    expect(body[LLAMA_DASH_TIMINGS_KEY]).toMatchObject({
      queued: false,
      queue_ms: 0,
      respond_ms: 10,
      prefill_ms: 1,
    })
    expect(readLlamaDashTimings(body)?.respond_ms).toBe(10)
  })
})
