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

  it('reads usage from a Responses API result', () => {
    expect(
      usageFromJsonBody(
        JSON.stringify({
          model: 'qwen3.8-next-flash',
          usage: {
            input_tokens: 28712,
            output_tokens: 40,
            total_tokens: 28752,
            input_tokens_details: { cached_tokens: 2048 },
          },
        }),
      ),
    ).toEqual({
      model: 'qwen3.8-next-flash',
      promptTokens: 28712,
      completionTokens: 40,
      totalTokens: 28752,
      cacheCreationTokens: null,
      cacheReadTokens: 2048,
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

  it('reads usage from a terminal Responses API event', () => {
    const scanner = new SseUsageScanner()
    scanner.feed(
      `event: response.completed\ndata: ${JSON.stringify({
        type: 'response.completed',
        response: {
          model: 'Qwen3.8-Flash-Next.gguf',
          usage: {
            input_tokens: 28712,
            output_tokens: 40,
            total_tokens: 28752,
            input_tokens_details: { cached_tokens: 2048 },
          },
        },
      })}\n\n`,
      100,
    )

    expect(scanner.done(110)).toEqual({
      model: 'Qwen3.8-Flash-Next.gguf',
      promptTokens: 28712,
      completionTokens: 40,
      totalTokens: 28752,
      cacheCreationTokens: null,
      cacheReadTokens: 2048,
      streamCloseMs: 10,
    })
  })

  it.each(['response.failed', 'response.incomplete'])('records stream close time for %s', (type) => {
    const scanner = new SseUsageScanner()
    scanner.feed(`event: ${type}\ndata: ${JSON.stringify({ type })}\n\n`, 100)

    expect(scanner.done(110).streamCloseMs).toBe(10)
  })
})
