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
})
