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

it('recovers complete messages from a truncated request without inventing partial content', () => {
  const captured =
    '{"instructions":"an escaped \\"input\\": [ decoy","input":[{"role":"user","content":[{"type":"input_text","text":"hello"}]},{"role":"assistant","content":[{"type":"output_text","text":"done"}]},{"role":"user","content":"incomplete'
  expect(requestMessages(`${captured}\n...[truncated 321 bytes]`)).toEqual([
    { role: 'user', text: 'hello' },
    { role: 'assistant', text: 'done' },
  ])
  expect(requestMessages('{"input":[{"role":"user","content":"hello"}]')).toEqual([])
  expect(requestMessages('{"input":[{"role":"user","content":"hello"}\n...[truncated 8 bytes]')).toEqual([
    { role: 'user', text: 'hello' },
  ])
})

it('shows Codex function calls and reasoning when a stream contains no output text', () => {
  const stream = [
    'event: response.output_item.done',
    'data: {"type":"response.output_item.done","item":{"type":"reasoning","summary":[{"type":"summary_text","text":"Checking files"}]}}',
    '',
    'event: response.output_item.done',
    'data: {"type":"response.output_item.done","item":{"type":"function_call","name":"shell","arguments":"{\\"cmd\\":\\"ls\\"}"}}',
    '',
  ].join('\n')
  expect(responseText(stream, true)).toContain('Checking files')
  expect(responseText(stream, true)).toContain('shell')
})
