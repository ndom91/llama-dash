import { describe, expect, it } from 'vitest'
import { SseUsageScanner, usageTokenSum } from './usage.ts'

describe('SseUsageScanner display phases', () => {
  it('uses GPU prefill and derives model loading from RELAY→RESPOND wall', () => {
    const dispatchAt = 1_000
    const scanner = new SseUsageScanner(dispatchAt)

    scanner.feed('data: {"choices":[{"delta":{"content":"Hi"}}]}\n\n', dispatchAt + 120)
    scanner.feed(
      'data: {"timings":{"prompt_ms":40,"predicted_ms":80},"usage":{"prompt_tokens":1,"completion_tokens":1}}\n\n',
      dispatchAt + 200,
    )
    scanner.feed('data: [DONE]\n\n', dispatchAt + 220)
    const usage = scanner.done(dispatchAt + 250)

    expect(usage.modelLoadingMs).toBe(80) // 120 - 40
    expect(usage.prefillMs).toBe(40)
    expect(usage.reasoningMs).toBeNull()
    expect(usage.responseMs).toBe(80)
  })

  it('uses REASON (not RESPOND) as model-loading end when reasoning comes first', () => {
    const dispatchAt = 500
    const scanner = new SseUsageScanner(dispatchAt)
    scanner.feed('data: {"choices":[{"delta":{"reasoning_content":"think"}}]}\n\n', dispatchAt + 80)
    scanner.feed('data: {"choices":[{"delta":{"content":"ans"}}]}\n\n', dispatchAt + 180)
    scanner.feed('data: {"timings":{"prompt_ms":30,"predicted_ms":200}}\n\n', dispatchAt + 190)
    scanner.feed('data: [DONE]\n\n', dispatchAt + 200)
    const usage = scanner.done(dispatchAt + 210)

    expect(usage.modelLoadingMs).toBe(50) // 80 - 30
    expect(usage.prefillMs).toBe(30)
    expect(usage.reasoningMs).toBe(100) // RESPOND - REASON
    expect(usage.responseMs).toBe(100) // 200 - 100
  })

  it('leaves reasoning null when REASON exists without RESPOND', () => {
    const dispatchAt = 0
    const scanner = new SseUsageScanner(dispatchAt)
    scanner.feed('data: {"choices":[{"delta":{"reasoning_content":"only"}}]}\n\n', 50)
    scanner.feed('data: {"timings":{"prompt_ms":10,"predicted_ms":40}}\n\n', 60)
    scanner.feed('data: [DONE]\n\n', 70)
    const usage = scanner.done(80)

    expect(usage.modelLoadingMs).toBe(40) // 50 - 10
    expect(usage.reasoningMs).toBeNull()
    expect(usage.responseMs).toBe(40)
  })

  it('leaves model loading null when there are no REASON/RESPOND tokens', () => {
    const scanner = new SseUsageScanner(0)
    scanner.feed('data: {"choices":[{"delta":{"role":"assistant"}}]}\n\n', 40)
    scanner.feed('data: [DONE]\n\n', 90)
    const usage = scanner.done(100)

    expect(usage.modelLoadingMs).toBeNull()
    expect(usage.prefillMs).toBeNull()
    expect(usage.reasoningMs).toBeNull()
    expect(usage.responseMs).toBeNull()
  })

  it('updates prompt/completion from timings_per_token as predicted_n grows', () => {
    const scanner = new SseUsageScanner(0)
    scanner.feed('data: {"choices":[{"delta":{"content":"a"}}],"timings":{"prompt_n":15,"predicted_n":1}}\n\n', 10)
    scanner.feed('data: {"choices":[{"delta":{"content":"b"}}],"timings":{"prompt_n":15,"predicted_n":3579}}\n\n', 100)
    scanner.feed('data: [DONE]\n\n', 110)
    const usage = scanner.done(120)

    expect(usage.promptTokens).toBe(15)
    expect(usage.completionTokens).toBe(3579)
    expect(usageTokenSum(usage)).toBe(3594)
  })

  it('tracks reasoning AND content when both are in the same delta', () => {
    const dispatchAt = 100
    const scanner = new SseUsageScanner(dispatchAt)
    // Single delta with both reasoning_content and content
    scanner.feed('data: {"choices":[{"delta":{"reasoning_content":"think","content":"ans"}}]}\n\n', dispatchAt + 50)
    scanner.feed('data: {"timings":{"prompt_ms":20,"predicted_ms":60}}\n\n', dispatchAt + 60)
    scanner.feed('data: [DONE]\n\n', dispatchAt + 70)
    const usage = scanner.done(dispatchAt + 80)

    // reasoningMs = 0 (same timestamp) → deriveDisplayPhases converts 0 to null
    expect(usage.reasoningMs).toBeNull()
    expect(usage.modelLoadingMs).toBe(30) // 50 - 20
    expect(usage.prefillMs).toBe(20)
  })

  it('tracks reasoning when it comes after content', () => {
    const dispatchAt = 0
    const scanner = new SseUsageScanner(dispatchAt)
    scanner.feed('data: {"choices":[{"delta":{"content":"first"}}]}\n\n', 10)
    scanner.feed('data: {"choices":[{"delta":{"reasoning_content":"then think"}}]}\n\n', 30)
    scanner.feed('data: {"choices":[{"delta":{"content":"final"}}]}\n\n', 50)
    scanner.feed('data: {"timings":{"prompt_ms":5,"predicted_ms":40}}\n\n', 60)
    scanner.feed('data: [DONE]\n\n', 70)
    const usage = scanner.done(80)

    // reasoningStartAtMs (30) > firstContentAtMs (10) → max(0, 10-30) = 0
    // deriveDisplayPhases converts 0 to null
    expect(usage.reasoningMs).toBeNull()
    // firstTokenAt = min(30, 10) = 10, modelLoadingMs = 10 - 5 = 5
    expect(usage.modelLoadingMs).toBe(5)
    expect(usage.prefillMs).toBe(5)
  })

  it('tracks reasoning-only stream (no content tokens)', () => {
    const dispatchAt = 0
    const scanner = new SseUsageScanner(dispatchAt)
    scanner.feed('data: {"choices":[{"delta":{"reasoning_content":"only reasoning"}}]}\n\n', 20)
    scanner.feed('data: {"timings":{"prompt_ms":10,"predicted_ms":30}}\n\n', 30)
    scanner.feed('data: [DONE]\n\n', 40)
    const usage = scanner.done(50)

    expect(usage.reasoningMs).toBeNull() // no content tokens
    expect(usage.modelLoadingMs).toBe(10) // 20 - 10
    expect(usage.prefillMs).toBe(10)
    expect(usage.responseMs).toBe(30) // predicted_ms - 0 (no reasoning)
  })

  it('tracks Anthropic reasoning (thinking_delta) and text (text_delta)', () => {
    const dispatchAt = 0
    const scanner = new SseUsageScanner(dispatchAt)
    scanner.feed(
      'data: {"type":"content_block_delta","index":0,"delta":{"type":"thinking_delta","thinking":"plan"}}\n\n',
      dispatchAt + 40,
    )
    scanner.feed(
      'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"answer"}}\n\n',
      dispatchAt + 100,
    )
    scanner.feed('data: {"type":"message_stop"}\n\n', dispatchAt + 110)
    const usage = scanner.done(dispatchAt + 120)

    expect(usage.reasoningMs).toBe(60) // 100 - 40
    expect(usage.modelLoadingMs).toBe(40) // 40 - 0
  })

  it('tracks Anthropic reasoning-only stream (no text_delta)', () => {
    const dispatchAt = 0
    const scanner = new SseUsageScanner(dispatchAt)
    scanner.feed(
      'data: {"type":"content_block_delta","index":0,"delta":{"type":"thinking_delta","thinking":"only thinking"}}\n\n',
      30,
    )
    scanner.feed('data: {"type":"message_stop"}\n\n', 40)
    const usage = scanner.done(50)

    expect(usage.reasoningMs).toBeNull() // no text_delta
    expect(usage.modelLoadingMs).toBe(30) // 30 - 0
  })

  it('tracks multi-chunk reasoning before content (OpenAI)', () => {
    const dispatchAt = 0
    const scanner = new SseUsageScanner(dispatchAt)
    scanner.feed('data: {"choices":[{"delta":{"reasoning_content":"step1"}}]}\n\n', 10)
    scanner.feed('data: {"choices":[{"delta":{"reasoning_content":"step2"}}]}\n\n', 20)
    scanner.feed('data: {"choices":[{"delta":{"reasoning_content":"step3"}}]}\n\n', 30)
    scanner.feed('data: {"choices":[{"delta":{"content":"result"}}]}\n\n', 50)
    scanner.feed('data: {"timings":{"prompt_ms":5,"predicted_ms":40}}\n\n', 60)
    scanner.feed('data: [DONE]\n\n', 70)
    const usage = scanner.done(80)

    // reasoningStartAtMs = 10 (first reasoning chunk), firstContentAtMs = 50
    expect(usage.reasoningMs).toBe(40) // 50 - 10
    expect(usage.modelLoadingMs).toBe(5) // 10 - 5
    expect(usage.prefillMs).toBe(5)
  })

  it('tracks multi-chunk reasoning before content (Anthropic)', () => {
    const dispatchAt = 0
    const scanner = new SseUsageScanner(dispatchAt)
    scanner.feed(
      'data: {"type":"content_block_delta","index":0,"delta":{"type":"thinking_delta","thinking":"step1"}}\n\n',
      10,
    )
    scanner.feed(
      'data: {"type":"content_block_delta","index":0,"delta":{"type":"thinking_delta","thinking":"step2"}}\n\n',
      25,
    )
    scanner.feed('data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"answer"}}\n\n', 60)
    scanner.feed('data: {"type":"message_stop"}\n\n', 70)
    const usage = scanner.done(80)

    // reasoningStartAtMs = 10, firstContentAtMs = 60
    expect(usage.reasoningMs).toBe(50) // 60 - 10
    expect(usage.modelLoadingMs).toBe(10) // 10 - 0
  })

  it('tracks reasoning timing when response is tool calls only (OpenAI)', () => {
    const dispatchAt = 0
    const scanner = new SseUsageScanner(dispatchAt)
    scanner.feed('data: {"choices":[{"delta":{"reasoning_content":"plan"}}]}\n\n', 30)
    scanner.feed(
      'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_1","type":"function","function":{"name":"f","arguments":"{}"}}]}}]}\n\n',
      80,
    )
    scanner.feed('data: [DONE]\n\n', 90)
    const usage = scanner.done(100)

    expect(usage.reasoningMs).toBe(50) // 80 - 30
    expect(usage.modelLoadingMs).toBe(30) // 30 - 0
  })

  it('tracks reasoning timing when response is tool calls only (Anthropic)', () => {
    const dispatchAt = 0
    const scanner = new SseUsageScanner(dispatchAt)
    scanner.feed(
      'data: {"type":"content_block_delta","index":0,"delta":{"type":"thinking_delta","thinking":"plan"}}\n\n',
      20,
    )
    scanner.feed(
      'data: {"type":"content_block_start","index":0,"delta":{"type":"tool_use","id":"t_1","name":"f","input":{}}}\n\n',
      70,
    )
    scanner.feed('data: {"type":"message_stop"}\n\n', 80)
    const usage = scanner.done(90)

    expect(usage.reasoningMs).toBe(50) // 70 - 20
    expect(usage.modelLoadingMs).toBe(20) // 20 - 0
  })

  it('sets model loading from tool-call-only response with no reasoning (OpenAI)', () => {
    const dispatchAt = 0
    const scanner = new SseUsageScanner(dispatchAt)
    scanner.feed(
      'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_1","type":"function","function":{"name":"f","arguments":"{}"}}]}}]}\n\n',
      60,
    )
    scanner.feed('data: {"timings":{"prompt_ms":10,"predicted_ms":50}}\n\n', 70)
    scanner.feed('data: [DONE]\n\n', 80)
    const usage = scanner.done(90)

    expect(usage.modelLoadingMs).toBe(50) // 60 - 10
    expect(usage.prefillMs).toBe(10)
    expect(usage.reasoningMs).toBeNull()
    expect(usage.responseMs).toBe(50)
  })

  it('reports newly observed REASON/RESPOND markers from feed()', () => {
    const scanner = new SseUsageScanner(0)
    const first = scanner.feed('data: {"choices":[{"delta":{"reasoning_content":"t"}}]}\n\n', 10)
    expect(first).toEqual({ reason: true, respond: false })
    const second = scanner.feed('data: {"choices":[{"delta":{"content":"hi"}}]}\n\n', 20)
    expect(second).toEqual({ reason: false, respond: true })
    const third = scanner.feed('data: {"choices":[{"delta":{"content":"!"}}]}\n\n', 30)
    expect(third).toEqual({ reason: false, respond: false })
  })
})
