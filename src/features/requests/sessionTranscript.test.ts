import { describe, expect, it } from 'vitest'
import type { CapturedRequest } from './sessionTranscript'
import {
  diffTranscript,
  parseTranscriptInput,
  parseTranscriptResponse,
  sessionInputTokens,
  sideRequest,
} from './sessionTranscript'

const input = (messages: unknown[]) => parseTranscriptInput(JSON.stringify({ messages }))
const user = (content: string) => ({ role: 'user', content })

describe('session transcript', () => {
  it('deduplicates repeated snapshots and preserves new suffixes', () => {
    const prior = input([user('one'), { role: 'assistant', content: 'answer' }])
    const next = input([user('one'), { role: 'assistant', content: 'answer' }, user('two')])
    expect(diffTranscript(prior, next)).toEqual({
      parts: [{ kind: 'message', role: 'user', text: 'two' }],
      replaced: null,
    })
  })
  it('marks context resets but does not infer them from truncated captures', () => {
    const prior = input([user('one'), user('two')])
    expect(diffTranscript(prior, input([user('replacement')]))).toEqual({
      parts: [{ kind: 'message', role: 'user', text: 'replacement' }],
      replaced: 2,
    })
    const partial = parseTranscriptInput(
      '{"messages":[{"role":"user","content":"replacement"},\n...[truncated 10 bytes]',
    )
    expect(diffTranscript(prior, partial).replaced).toBeNull()
  })
  it('extracts tool calls and results from Anthropic and Codex inputs and responses', () => {
    const parsed = input([
      { role: 'assistant', content: [{ type: 'tool_use', name: 'Bash', input: { command: 'ls' } }] },
      { role: 'user', content: [{ type: 'tool_result', content: 'file' }] },
    ])
    expect(parsed.parts.flat().map((part) => part.kind)).toEqual(['tool', 'result'])
    const response =
      'data: {"type":"response.output_item.done","item":{"type":"function_call","name":"shell","arguments":"ls"}}\n\n'
    expect(parseTranscriptResponse(response, true)).toEqual([
      { kind: 'tool', role: 'assistant', name: 'shell', text: 'ls' },
    ])
    const anthropic =
      'event: content_block_start\ndata: {"type":"content_block_start","index":0,"content_block":{"type":"tool_use","name":"Read"}}\n\nevent: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"input_json_delta","partial_json":"{}"}}\n\n'
    expect(parseTranscriptResponse(anthropic, true)).toEqual([
      { kind: 'tool', role: 'assistant', name: 'Read', text: '{}' },
    ])
  })
  it('does not classify every error as a probe', () => {
    const req = { statusCode: 429 } as CapturedRequest
    expect(sideRequest(req, input([user('Please fix the deployment')]))).toBeNull()
    expect(sideRequest(req, input([user('quota probe')]))).toBe('probe')
  })
})

it('extracts reminder blocks from user text and keeps their original capture for diffing', () => {
  const parsed = input([user('Hello\n<system-reminder>Read ~/.claude/CLAUDE.md first</system-reminder>\nworld')])
  expect(parsed.parts.flat()).toEqual([{ kind: 'message', role: 'user', text: 'Hello\n\nworld' }])
  expect(parsed.contexts).toEqual([
    { kind: 'reminder', label: '~/.claude/CLAUDE.md', text: 'Read ~/.claude/CLAUDE.md first' },
  ])
  expect(diffTranscript(parsed, parsed).parts).toEqual([])
})

it('matches tool call identifiers and normalizes streamed Chat tool calls', () => {
  const parsed = input([
    { role: 'assistant', content: [{ type: 'tool_use', id: 'call1', name: 'Bash', input: { command: 'ls' } }] },
    { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'call1', content: '+file', is_error: true }] },
  ])
  expect(parsed.parts.flat().map((part) => part.id)).toEqual(['call1', 'call1'])
  expect(parsed.parts.flat()[1].isError).toBe(true)
  const body = [
    'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call1","function":{"name":"shell","arguments":"{"}}]}}]}',
    '',
    'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"}"}}]}}]}',
    '',
  ].join('\n')
  expect(parseTranscriptResponse(body, true)).toEqual([
    { kind: 'tool', role: 'assistant', name: 'shell', id: 'call1', text: '{}' },
  ])
})

it('recognizes explicit count-token and helper requests while keeping ambiguous traffic as main', () => {
  expect(sideRequest({ endpoint: '/v1/messages/count_tokens', statusCode: 200 } as CapturedRequest, input([]))).toBe(
    'count',
  )
  expect(
    sideRequest(
      { endpoint: '/v1/messages', statusCode: 200, model: 'claude-haiku' } as CapturedRequest,
      input([user('Summarize this for a subagent')]),
    ),
  ).toBe('helper')
  expect(
    sideRequest(
      { endpoint: '/v1/messages', statusCode: 200, model: 'claude-haiku' } as CapturedRequest,
      input([user('Build a calendar')]),
    ),
  ).toBeNull()
})

it('ignores object key order in unchanged snapshots and suppresses the already shown prior response', () => {
  const previous = input([{ role: 'user', content: 'one' }])
  const current = input([{ content: 'one', role: 'user' }, { role: 'assistant', content: 'answer' }, user('two')])
  const result = diffTranscript(previous, current, [{ kind: 'message', role: 'assistant', text: 'answer' }])
  expect(result).toEqual({ parts: [{ kind: 'message', role: 'user', text: 'two' }], replaced: null })
})

it('keeps both text and tool calls from a terminal Responses event without duplicating streamed calls', () => {
  const item = { type: 'function_call', call_id: 'call-1', name: 'shell', arguments: '{}' }
  const body = `data: ${JSON.stringify({ type: 'response.output_item.done', item })}\n\ndata: ${JSON.stringify({ type: 'response.completed', response: { output: [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'Running command' }] }, item] } })}\n\n`
  const parts = parseTranscriptResponse(body, true)
  expect(parts.map((part) => part.kind)).toEqual(['message', 'tool'])
  expect(parts[0].text).toBe('Running command')
})

it('counts separately reported Anthropic cache tokens only once', () => {
  const usage = { promptTokens: 10, cacheReadTokens: 70, cacheCreationTokens: 20 }
  expect(sessionInputTokens({ ...usage, endpoint: '/v1/messages' })).toBe(100)
  expect(sessionInputTokens({ ...usage, endpoint: '/v1/responses' })).toBe(10)
})

it('suppresses only the matching occurrence and preserves distinct tool call ids', () => {
  const before = input([user('hi')])
  const after = input([
    user('hi'),
    { type: 'function_call', call_id: 'a', name: 'shell', arguments: '{}' },
    { type: 'function_call', call_id: 'b', name: 'shell', arguments: '{}' },
  ])
  const previous = [{ kind: 'tool' as const, role: 'assistant', id: 'a', name: 'shell', text: '{}' }]
  expect(diffTranscript(before, after, previous).parts.map((part) => part.id)).toEqual(['b'])
})

it('preserves streaming reasoning, tool and message order', () => {
  const events = [
    { type: 'response.reasoning_summary_text.delta', output_index: 0, delta: 'thinking' },
    {
      type: 'response.output_item.done',
      output_index: 1,
      item: { type: 'function_call', call_id: 'c', name: 'shell', arguments: '{}' },
    },
    { type: 'response.output_text.delta', output_index: 2, delta: 'answer' },
  ]
  expect(
    parseTranscriptResponse(events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join(''), true).map(
      (part) => part.kind,
    ),
  ).toEqual(['thinking', 'tool', 'message'])
})

it('leaves missing or truncated 429 captures as main requests', () => {
  const request = { statusCode: 429, endpoint: '/v1/responses', model: 'codex' } as CapturedRequest
  expect(sideRequest(request, parseTranscriptInput(null))).toBeNull()
  expect(sideRequest(request, parseTranscriptInput('{"input":[\n...[truncated 100 bytes]'))).toBeNull()
  expect(sideRequest(request, parseTranscriptInput('{"input":[]}'))).toBe('probe')
})

it('retains streamed text if the completed event contains only a tool', () => {
  const events = [
    { type: 'response.output_text.delta', output_index: 0, delta: 'Working' },
    {
      type: 'response.completed',
      response: { output: [{ type: 'function_call', call_id: 'call', name: 'shell', arguments: '{}' }] },
    },
  ]
  const parts = parseTranscriptResponse(events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join(''), true)
  expect(parts.map((part) => part.kind)).toEqual(['message', 'tool'])
  expect(parts[0].text).toBe('Working')
})
