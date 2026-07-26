import { describe, expect, it } from 'vitest'
import { forceUpstreamStream, SseToJsonCompletionAssembler } from './assemble-sse-completion.ts'

describe('SseToJsonCompletionAssembler OpenAI chat', () => {
  it('assembles deltas into chat.completion', () => {
    const a = new SseToJsonCompletionAssembler()
    a.feed(
      [
        'data: {"id":"chatcmpl_1","object":"chat.completion.chunk","created":1700000000,"model":"llama3","choices":[{"index":0,"delta":{"role":"assistant"}}]}\n\n',
        'data: {"id":"chatcmpl_1","choices":[{"index":0,"delta":{"content":"Hel"}}]}\n\n',
        'data: {"id":"chatcmpl_1","choices":[{"index":0,"delta":{"content":"lo"}}]}\n\n',
        'data: {"id":"chatcmpl_1","model":"llama3","choices":[{"index":0,"delta":{},"finish_reason":"stop"}],"usage":{"prompt_tokens":3,"completion_tokens":2},"timings":{"prompt_ms":10,"predicted_ms":20}}\n\n',
        'data: [DONE]\n\n',
      ].join(''),
    )
    const out = a.result('/v1/chat/completions')
    expect(out?.protocol).toBe('openai-chat')
    expect(out?.body).toMatchObject({
      id: 'chatcmpl_1',
      object: 'chat.completion',
      model: 'llama3',
      choices: [
        {
          index: 0,
          message: { role: 'assistant', content: 'Hello' },
          finish_reason: 'stop',
        },
      ],
      usage: { prompt_tokens: 3, completion_tokens: 2, total_tokens: 5 },
      timings: { prompt_ms: 10, predicted_ms: 20 },
    })
  })

  it('assembles reasoning_content', () => {
    const a = new SseToJsonCompletionAssembler()
    a.feed('data: {"choices":[{"delta":{"reasoning_content":"think "}}]}\n\n')
    a.feed('data: {"choices":[{"delta":{"reasoning_content":"hard","content":"ok"}}]}\n\n')
    a.feed('data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\n')
    const out = a.result('/v1/chat/completions')
    expect(out?.body.choices).toEqual([
      {
        index: 0,
        message: { role: 'assistant', content: 'ok', reasoning_content: 'think hard' },
        finish_reason: 'stop',
      },
    ])
  })
})

describe('SseToJsonCompletionAssembler OpenAI chat tool calls', () => {
  it('merges streamed tool_calls arguments', () => {
    const a = new SseToJsonCompletionAssembler()
    a.feed(
      'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_1","type":"function","function":{"name":"get_weather","arguments":"{\\"city\\":"}}]}}]}\n\n',
    )
    a.feed(
      'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"\\"NYC\\"}"}}]},"finish_reason":"tool_calls"}]}\n\n',
    )
    const out = a.result('/v1/chat/completions')
    expect(out?.body.choices).toEqual([
      {
        index: 0,
        message: {
          role: 'assistant',
          content: null,
          tool_calls: [
            {
              id: 'call_1',
              type: 'function',
              function: { name: 'get_weather', arguments: '{"city":"NYC"}' },
            },
          ],
        },
        finish_reason: 'tool_calls',
      },
    ])
  })
})

describe('SseToJsonCompletionAssembler Anthropic messages', () => {
  it('assembles message_start + text blocks + message_delta', () => {
    const a = new SseToJsonCompletionAssembler()
    a.feed(
      [
        'data: {"type":"message_start","message":{"id":"msg_1","type":"message","role":"assistant","content":[],"model":"claude","stop_reason":null,"usage":{"input_tokens":10,"output_tokens":1}}}\n\n',
        'data: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}\n\n',
        'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hi"}}\n\n',
        'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"!"}}\n\n',
        'data: {"type":"content_block_stop","index":0}\n\n',
        'data: {"type":"message_delta","delta":{"stop_reason":"end_turn","stop_sequence":null},"usage":{"output_tokens":2}}\n\n',
        'data: {"type":"message_stop"}\n\n',
      ].join(''),
    )
    const out = a.result('/v1/messages')
    expect(out?.protocol).toBe('anthropic-messages')
    expect(out?.body).toMatchObject({
      id: 'msg_1',
      type: 'message',
      role: 'assistant',
      model: 'claude',
      content: [{ type: 'text', text: 'Hi!' }],
      stop_reason: 'end_turn',
      usage: { input_tokens: 10, output_tokens: 2 },
    })
  })
})

describe('forceUpstreamStream', () => {
  it('sets stream true when missing or false', () => {
    expect(forceUpstreamStream({ model: 'x' })).toEqual({
      body: { model: 'x', stream: true },
      mutated: true,
    })
    expect(forceUpstreamStream({ model: 'x', stream: false }).mutated).toBe(true)
    expect(forceUpstreamStream({ model: 'x', stream: true }).mutated).toBe(false)
  })
})
