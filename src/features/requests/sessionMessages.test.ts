import { expect, it } from 'vitest'
import { requestMessages, responseText } from './sessionMessages'

it('reads Anthropic messages and OpenAI Responses input, including tool calls', () => {
  expect(
    requestMessages(JSON.stringify({ messages: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }] })),
  ).toEqual([{ role: 'user', text: 'Hello' }])
  expect(
    requestMessages(JSON.stringify({ input: [{ type: 'function_call', name: 'read', arguments: '{}' }] }))[0].text,
  ).toContain('function_call')
  expect(requestMessages('{broken')).toEqual([])
})

it('assembles streamed responses and reads complete JSON responses', () => {
  expect(
    responseText(
      'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Hi"}}\n\n',
      true,
    ),
  ).toBe('Hi')
  expect(responseText('data: {"type":"response.output_text.delta","delta":"Hi"}\n\n', true)).toBe('Hi')
  expect(responseText('{"choices":[{"message":{"content":"Hi"}}]}', false)).toBe('Hi')
})
