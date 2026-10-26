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
  it('extracts phase timings even when standard usage is present', () => {
    const result = usageFromJsonBody(
      JSON.stringify({
        usage: { prompt_tokens: 4, completion_tokens: 2 },
        timings: { prompt_ms: 101.25, predicted_ms: 455.9 },
      }),
    )
    expect(result).toMatchObject({ promptTokens: 4, completionTokens: 2, prefillMs: 101.25, decodeMs: 455.9 })
  })

  it('rejects invalid phase durations and preserves zero', () => {
    expect(usageFromJsonBody('{"timings":{"prompt_ms":0,"predicted_ms":-1}}')).toMatchObject({ prefillMs: 0 })
    expect(usageFromJsonBody('{"timings":{"prompt_ms":"bad","predicted_ms":-1}}')).not.toHaveProperty('decodeMs')
    expect(usageFromJsonBody('not json')).not.toHaveProperty('prefillMs')
  })
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
      cacheReadTokensIncludedInPrompt: true,
    })
  })

  it('keeps Anthropic cache reads separate from prompt tokens', () => {
    expect(
      usageFromJsonBody(
        JSON.stringify({
          model: 'claude-sonnet-4-5',
          usage: {
            input_tokens: 100,
            cache_read_input_tokens: 900,
            output_tokens: 10,
          },
        }),
      ),
    ).toEqual({
      model: 'claude-sonnet-4-5',
      promptTokens: 100,
      completionTokens: 10,
      totalTokens: 110,
      cacheCreationTokens: null,
      cacheReadTokens: 900,
    })
  })
})

describe('SseUsageScanner', () => {
  it('measures meaningful Responses API output without counting lifecycle events', () => {
    const scanner = new SseUsageScanner(1000)
    scanner.feed('data: {"type":"response.created"}\n\n', 1050)
    scanner.feed('data: {"type":"response.output_text.delta","delta":""}\n\n', 1100)
    scanner.feed('data: {"type":"response.function_call_arguments.delta","delta":"{', 1200)
    scanner.feed('"}\n\n', 1250)
    scanner.feed('data: {"type":"response.reasoning_summary_text.delta","delta":"thinking"}\n\n', 1400)
    scanner.feed('data: {"type":"response.completed"}\n\n', 1500)
    expect(scanner.done(1550)).toMatchObject({ firstOutputMs: 250, outputSpanMs: 150, streamCloseMs: 50 })
  })

  it('measures chat and Anthropic deltas and leaves missing output unset', () => {
    const scanner = new SseUsageScanner(100)
    scanner.feed('data: {"choices":[{"delta":{"role":"assistant"}}]}\n\n', 120)
    expect(scanner.done()).not.toHaveProperty('firstOutputMs')
    scanner.feed('data: {"choices":[{"delta":{"tool_calls":[{"index":0}]}}]}\n\n', 200)
    scanner.feed('data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"hello"}}\n\n', 230)
    expect(scanner.done()).toMatchObject({ firstOutputMs: 100, outputSpanMs: 30 })
  })

  it('recognizes CRLF event boundaries split across chunks', () => {
    const scanner = new SseUsageScanner(100)
    scanner.feed('data: {"type":"response.output_text.delta","delta":"a"}\r\n\r', 150)
    scanner.feed('\n', 175)
    expect(scanner.done()).toMatchObject({ firstOutputMs: 75, outputSpanMs: 0 })
  })
  it('retains the latest valid timings across the full stream', () => {
    const scanner = new SseUsageScanner()
    scanner.feed(`data: ${JSON.stringify({ timings: { prompt_ms: 10.5, predicted_ms: 20 } })}\n\n`, 1)
    scanner.feed(`data: ${JSON.stringify({ timings: { predicted_ms: 90.25 } })}\n\ndata: [DONE]\n\n`, 2)
    expect(scanner.done(3)).toMatchObject({ prefillMs: 10.5, decodeMs: 90.25, streamCloseMs: 1 })
  })
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
      cacheReadTokensIncludedInPrompt: true,
      streamCloseMs: 10,
    })
  })

  it.each(['response.failed', 'response.incomplete'])('records stream close time for %s', (type) => {
    const scanner = new SseUsageScanner()
    scanner.feed(`event: ${type}\ndata: ${JSON.stringify({ type })}\n\n`, 100)

    expect(scanner.done(110).streamCloseMs).toBe(10)
  })
})
