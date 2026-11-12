// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { interleaveInputParts, SessionSplitTimeline } from './SessionSplitTimeline'
import type { TranscriptExchange, TranscriptFilters } from './SessionTranscriptView'
import type { CapturedRequest, TranscriptPart } from './sessionTranscript'

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a href="/request">{children}</a>,
}))
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  Reflect.deleteProperty(navigator, 'clipboard')
})
const filters: TranscriptFilters = {
  messages: true,
  tools: true,
  results: false,
  thinking: false,
  side: false,
  context: true,
}

it('interleaves matching calls and results without crossing messages or losing unmatched blocks', () => {
  const parts: TranscriptPart[] = [
    { kind: 'tool', role: 'assistant', id: 'a', text: 'read a' },
    { kind: 'tool', role: 'assistant', id: 'b', text: 'read b' },
    { kind: 'result', role: 'tool', id: 'b', text: 'result b' },
    { kind: 'result', role: 'tool', id: 'a', text: 'result a' },
    { kind: 'result', role: 'tool', id: 'orphan', text: 'orphan' },
    { kind: 'message', role: 'user', text: 'next' },
    { kind: 'result', role: 'tool', id: 'a', text: 'later' },
  ]
  expect(interleaveInputParts(parts).map(({ index }) => index)).toEqual([0, 3, 1, 2, 4, 5, 6])
})

it('renders a single user header with the timestamp alongside it', () => {
  const item = exchange(1, [{ kind: 'message', role: 'user', text: 'Hello' }], [])
  const view = render(<SessionSplitTimeline exchanges={[item]} filters={filters} activeId={null} />)
  const message = screen.getByText('Hello')
  const header = message.parentElement?.previousElementSibling
  expect(header?.textContent).toContain('user')
  expect(header?.querySelector('time')?.className).not.toContain('ml-auto')
  expect(message.parentElement?.className).toContain('border-l')
  expect(view.container.querySelector('.session-sent-strip')).toBeNull()
})

it('copies user and assistant source text with icon-only controls', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
  const item = exchange(
    1,
    [{ kind: 'message', role: 'user', text: 'User text' }],
    [{ kind: 'message', role: 'assistant', text: '**Assistant source**' }],
  )
  render(<SessionSplitTimeline exchanges={[item]} filters={filters} activeId={null} />)
  const userCopy = screen.getByRole('button', { name: 'Copy user message' })
  const assistantCopy = screen.getByRole('button', { name: 'Copy assistant message' })
  expect(userCopy.textContent).toBe('')
  expect(assistantCopy.textContent).toBe('')
  fireEvent.click(userCopy)
  fireEvent.click(assistantCopy)
  await waitFor(() => expect(writeText.mock.calls).toEqual([['User text'], ['**Assistant source**']]))
})

it('places each input result immediately after its matching call', () => {
  const item = exchange(
    1,
    [
      { kind: 'tool', role: 'assistant', name: 'Read', id: 'a', text: 'file-a' },
      { kind: 'tool', role: 'assistant', name: 'Read', id: 'b', text: 'file-b' },
      { kind: 'result', role: 'tool', id: 'a', text: 'contents-a' },
      { kind: 'result', role: 'tool', id: 'b', text: 'contents-b' },
    ],
    [],
  )
  const view = render(<SessionSplitTimeline exchanges={[item]} filters={filters} activeId={null} />)
  const text = view.container.querySelector('.session-conversation')!.textContent!
  expect(text.indexOf('file-a')).toBeLessThan(text.indexOf('contents-a'))
  expect(text.indexOf('contents-a')).toBeLessThan(text.indexOf('file-b'))
  expect(text.indexOf('file-b')).toBeLessThan(text.indexOf('contents-b'))
})
function exchange(number: number, inputParts: TranscriptPart[], responseParts: TranscriptPart[]): TranscriptExchange {
  return {
    request: {
      id: `req${number}`,
      durationMs: 100,
      statusCode: 200,
      startedAt: '2026-01-01T00:00:00Z',
      endpoint: '/v1/messages',
      promptTokens: 10,
      completionTokens: 2,
      cacheReadTokens: null,
      payloads: { requestBody: null, responseBody: null },
    } as CapturedRequest,
    number,
    inputParts,
    responseParts,
    parts: [...inputParts, ...responseParts],
    side: null,
    replaced: null,
    contexts: [],
    inputDelta: 10,
  }
}

it('links matching tool IDs and lazily opens a collapsed run when navigating', async () => {
  const call = { kind: 'tool', role: 'assistant', id: 'call-1', name: 'Bash', text: 'ls' } as const
  const result = { kind: 'result', role: 'tool', id: 'call-1', text: 'one\ntwo\nthree\nfour\nfive' } as const
  const rows = [
    exchange(1, [{ kind: 'message', role: 'user', text: 'Run a command' }], [call]),
    ...Array.from({ length: 9 }, (_, i) =>
      exchange(i + 2, i === 0 ? [result] : [], [
        { kind: 'tool', role: 'assistant', id: `other-${i}`, text: 'command' },
      ]),
    ),
  ]
  const scroll = vi.fn()
  Element.prototype.scrollIntoView = scroll
  const view = render(<SessionSplitTimeline exchanges={rows} filters={filters} activeId="req1" />)
  const chip = screen.getByRole('button', { name: '→ #2' })
  fireEvent.mouseEnter(chip.parentElement!)
  expect(view.container.querySelectorAll('.is-linked')).toHaveLength(1)
  fireEvent.click(chip)
  expect(screen.getByText(/show 9 requests/).closest('details')?.open).toBe(true)
  await waitFor(() => expect(scroll).toHaveBeenCalled())
  expect(screen.getByText('five').closest('[aria-hidden="true"]')).toBeTruthy()
  expect(view.container.querySelectorAll('.is-linked')).toHaveLength(2)
  fireEvent.click(screen.getByRole('button', { name: 'expand' }))
  expect(screen.getByText('five')).toBeTruthy()
  expect(screen.getByRole('button', { name: '← #1' })).toBeTruthy()
  expect(view.container.querySelector('#session-req1')?.classList.contains('is-active')).toBe(true)
})

it('shows unmatched calls and captured stop reasons', () => {
  const item = exchange(1, [], [{ kind: 'tool', role: 'assistant', id: 'missing', name: 'Bash', text: 'pwd' }])
  item.request.payloads.responseBody = '{"stop_reason":"end_turn"}'
  const view = render(<SessionSplitTimeline exchanges={[item]} filters={filters} activeId={null} />)
  expect(screen.getByText('no result captured')).toBeTruthy()
  expect(screen.getByText(/end_turn/)).toBeTruthy()
  expect(view.container.querySelector('.is-final')).toBeTruthy()
  expect(view.container.querySelector('.session-split-meta.is-end')).toBeTruthy()
})

it('marks tool-call metadata for Anthropic and OpenAI stop reasons', () => {
  const anthropic = exchange(1, [], [])
  anthropic.request.payloads.responseBody = '{"stop_reason":"tool_use"}'
  const openai = exchange(2, [], [])
  openai.request.payloads.responseBody = '{"choices":[{"finish_reason":"tool_calls"}]}'
  const view = render(<SessionSplitTimeline exchanges={[anthropic, openai]} filters={filters} activeId={null} />)
  expect(view.container.querySelectorAll('.session-split-meta.is-tool')).toHaveLength(2)
})

it('distinguishes unloaded results from missing results', () => {
  const item = exchange(1, [], [{ kind: 'tool', role: 'assistant', id: 'missing', text: 'pwd' }])
  const view = render(<SessionSplitTimeline exchanges={[item]} filters={filters} activeId={null} incomplete />)
  expect(screen.getByText('result may be in unloaded requests')).toBeTruthy()
  view.rerender(<SessionSplitTimeline exchanges={[item]} filters={filters} activeId={null} incomplete={false} />)
  expect(screen.getByText('no result captured')).toBeTruthy()
})

it('lets the global result filter override a manual toggle', () => {
  const result = { kind: 'result', role: 'tool', text: 'one\ntwo\nthree\nfour\nfive' } as const
  const item = exchange(1, [result], [])
  const view = render(<SessionSplitTimeline exchanges={[item]} filters={filters} activeId={null} />)
  fireEvent.click(screen.getByRole('button', { name: 'expand' }))
  expect(screen.getByText('five')).toBeTruthy()
  view.rerender(<SessionSplitTimeline exchanges={[item]} filters={{ ...filters, results: true }} activeId={null} />)
  fireEvent.click(screen.getByRole('button', { name: 'collapse' }))
  expect(screen.getByText('five').closest('[aria-hidden="true"]')).toBeTruthy()
  view.rerender(<SessionSplitTimeline exchanges={[item]} filters={{ ...filters, results: false }} activeId={null} />)
  view.rerender(<SessionSplitTimeline exchanges={[item]} filters={{ ...filters, results: true }} activeId={null} />)
  expect(screen.getByText('five')).toBeTruthy()
})

it('keeps very large result content unmounted until expanded', () => {
  const result = {
    kind: 'result',
    role: 'tool',
    text: Array.from({ length: 121 }, (_, i) => `line-${i}`).join('\n'),
  } as const
  const view = render(
    <SessionSplitTimeline exchanges={[exchange(1, [result], [])]} filters={filters} activeId={null} />,
  )
  expect(screen.queryByText('line-120')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'expand' }))
  expect(screen.getByText('line-120')).toBeTruthy()
  expect(view.container.querySelector('.session-result.t-acc')).toBeNull()
})

it('applies message and tool filters to side requests', () => {
  const item = exchange(
    1,
    [{ kind: 'message', role: 'user', text: 'hidden message' }],
    [{ kind: 'tool', role: 'assistant', name: 'HiddenTool', text: 'pwd' }],
  )
  item.side = 'helper'
  render(
    <SessionSplitTimeline
      exchanges={[item]}
      filters={{ ...filters, side: true, messages: false, tools: false }}
      activeId={null}
    />,
  )
  expect(screen.queryByText('hidden message')).toBeNull()
  expect(screen.queryByText('HiddenTool')).toBeNull()
})

it('explains a missing response even when input was captured', () => {
  const item = exchange(1, [{ kind: 'message', role: 'user', text: 'hello' }], [])
  render(<SessionSplitTimeline exchanges={[item]} filters={filters} activeId={null} />)
  expect(screen.getByText(/no readable content/)).toBeTruthy()
})

it('shows a capture limit notice, a single raw control, and a compaction marker', () => {
  const item = exchange(19, [], [{ kind: 'message', role: 'assistant', text: 'Finished' }])
  item.inputDelta = -114416
  item.request.promptTokens = 1000
  item.request.cacheReadTokens = 0
  item.request.payloads.requestBody = 'prefix\n...[truncated 100 bytes]'
  item.request.payloads.responseBody = '{"stop_reason":"end_turn"}'
  const view = render(<SessionSplitTimeline exchanges={[item]} filters={filters} activeId={null} />)
  expect(screen.getByText(/context compacted before #19/)).toBeTruthy()
  expect(screen.getByText(/input not captured · new messages are past the capture limit/)).toBeTruthy()
  expect(view.container.querySelectorAll('.session-capture-controls')).toHaveLength(1)
  expect(screen.getAllByRole('link', { name: 'raw ↗' })).toHaveLength(1)
  expect(screen.queryByRole('button', { name: 'raw' })).toBeNull()
  expect(view.container.querySelector('.session-stop-badge')?.textContent).toContain('end_turn')
})

it('does not mark a complete unchanged input as missing', () => {
  const item = exchange(1, [], [{ kind: 'message', role: 'assistant', text: 'Finished' }])
  item.request.payloads.requestBody = '{"messages":[]}'
  render(<SessionSplitTimeline exchanges={[item]} filters={filters} activeId={null} />)
  expect(screen.queryByText(/input not captured/)).toBeNull()
})
