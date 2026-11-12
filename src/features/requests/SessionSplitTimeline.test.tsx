// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { SessionSplitTimeline } from './SessionSplitTimeline'
import type { TranscriptExchange, TranscriptFilters } from './SessionTranscriptView'
import type { CapturedRequest, TranscriptPart } from './sessionTranscript'

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a href="/request">{children}</a>,
}))
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})
const filters: TranscriptFilters = {
  messages: true,
  tools: true,
  results: false,
  thinking: false,
  side: false,
  context: true,
}
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

it('links matching tool IDs, highlights the pair, and opens a collapsed run when navigating', () => {
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
  expect(view.container.querySelectorAll('.is-linked')).toHaveLength(2)
  fireEvent.click(chip)
  expect(screen.getByText(/show 9 requests/).closest('details')?.open).toBe(true)
  expect(scroll).toHaveBeenCalled()
  expect(screen.queryByText('five')).toBeNull()
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
  expect(screen.getByText('end_turn')).toBeTruthy()
  expect(view.container.querySelector('.is-final')).toBeTruthy()
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
  expect(screen.queryByText('five')).toBeNull()
  view.rerender(<SessionSplitTimeline exchanges={[item]} filters={{ ...filters, results: false }} activeId={null} />)
  view.rerender(<SessionSplitTimeline exchanges={[item]} filters={{ ...filters, results: true }} activeId={null} />)
  expect(screen.getByText('five')).toBeTruthy()
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
