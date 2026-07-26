import { describe, expect, it } from 'vitest'
import { SseContentAssembler } from './sse-content-assembler.ts'

describe('SseContentAssembler', () => {
  it('splits OpenAI reasoning_content and content deltas', () => {
    const a = new SseContentAssembler()
    a.feed('data: {"choices":[{"delta":{"reasoning_content":"think "}}]}\n\n')
    a.feed('data: {"choices":[{"delta":{"reasoning_content":"hard"}}]}\n\n')
    a.feed('data: {"choices":[{"delta":{"content":"Hi"}}]}\n\n')
    a.feed('data: {"choices":[{"delta":{"content":"!"}}]}\n\n')
    a.feed('data: [DONE]\n\n')
    expect(a.result()).toEqual({ reasoning: 'think hard', response: 'Hi!', toolCalls: null, citations: null })
  })

  it('handles Anthropic thinking and text deltas', () => {
    const a = new SseContentAssembler()
    a.feed('data: {"type":"content_block_delta","delta":{"type":"thinking_delta","thinking":"plan"}}\n\n')
    a.feed('data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"ans"}}\n\n')
    expect(a.result()).toEqual({ reasoning: 'plan', response: 'ans', toolCalls: null, citations: null })
  })

  it('returns nulls when empty', () => {
    expect(new SseContentAssembler().result()).toEqual({
      reasoning: null,
      response: null,
      toolCalls: null,
      citations: null,
    })
  })
})
