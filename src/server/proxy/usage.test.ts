import { describe, expect, it } from 'vitest'
import { SseUsageScanner, usageFromJsonBody } from './usage'

const nativeInfillResponse = JSON.stringify({
  content: '',
  'timings/prompt_n': 775,
  'timings/predicted_n': 1,
  tokens_cached: 775,
  truncated: false,
})

describe('usageFromJsonBody', () => {
  it('reads flattened llama.cpp timing fields from native infill responses', () => {
    expect(usageFromJsonBody(nativeInfillResponse)).toEqual({
      model: null,
      promptTokens: 775,
      completionTokens: 1,
      totalTokens: 776,
      cacheCreationTokens: null,
      cacheReadTokens: null,
    })
  })
})

describe('SseUsageScanner', () => {
  it('reads flattened llama.cpp timing fields from streamed native infill responses', () => {
    const scanner = new SseUsageScanner()
    scanner.feed(`data: ${nativeInfillResponse}\n\ndata: [DONE]\n\n`, 100)

    expect(scanner.done(110)).toEqual({
      model: null,
      promptTokens: 775,
      completionTokens: 1,
      totalTokens: 776,
      cacheCreationTokens: null,
      cacheReadTokens: null,
      streamCloseMs: 10,
    })
  })
})
