// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { SessionTranscriptView, type TranscriptExchange, type TranscriptFilters } from './SessionTranscriptView'
import type { CapturedRequest } from './sessionTranscript'

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a href="/request">{children}</a>,
}))
afterEach(cleanup)
const filters: TranscriptFilters = {
  messages: true,
  tools: true,
  results: false,
  thinking: false,
  side: false,
  context: true,
}
const request = (id: string) =>
  ({
    id,
    model: 'model',
    statusCode: 200,
    durationMs: 10,
    startedAt: '2026-01-01T00:00:00Z',
    promptTokens: 10,
    completionTokens: 2,
    cacheReadTokens: null,
    payloads: { requestBody: null, responseBody: null },
  }) as CapturedRequest
const exchange = (id: string, number: number): TranscriptExchange => ({
  request: request(id),
  number,
  parts: [],
  replaced: null,
  side: null,
  contexts: [],
  inputDelta: 10,
})

it('pairs tool results across requests and leaves unmatched results visible', () => {
  const first = exchange('first', 1)
  first.parts = [{ kind: 'tool', role: 'assistant', name: 'Bash', id: 'call1', text: 'ls' }]
  const second = exchange('second', 2)
  second.parts = [
    { kind: 'result', role: 'tool', id: 'call1', text: '+file' },
    { kind: 'result', role: 'tool', id: 'other', text: 'orphan' },
  ]
  render(<SessionTranscriptView exchanges={[first, second]} filters={filters} />)
  const call = screen.getByText(/Bash/).closest('details')!
  expect(call.textContent).toContain('+file')
  expect(call.open).toBe(false)
  expect(screen.getByText('orphan')).toBeTruthy()
  expect(screen.getAllByText('+file')).toHaveLength(1)
})

it('collapses long runs of tool-only requests and keeps their details available', () => {
  const exchanges = Array.from({ length: 9 }, (_, i) => ({
    ...exchange(`req${i}`, i + 1),
    parts: [{ kind: 'tool' as const, role: 'assistant', name: 'Read', text: 'file' }],
  }))
  render(<SessionTranscriptView exchanges={exchanges} filters={filters} />)
  const summary = screen.getByText(/9 more · show/)
  expect(summary.closest('details')?.open).toBe(false)
  fireEvent.click(summary)
  expect(summary.closest('details')?.open).toBe(true)
})

it('displays context changes, reset notices and one-line truncation with a raw link', () => {
  const item = exchange('first', 1)
  item.replaced = 2
  item.contexts = [{ kind: 'reminder', label: 'CLAUDE.md', text: 'instructions', changed: true }]
  item.request.payloads.requestBody = 'prefix\n...[truncated 1024 bytes]'
  render(<SessionTranscriptView exchanges={[item]} filters={filters} />)
  expect(screen.getByText(/context reset · 2 messages replaced/)).toBeTruthy()
  expect(screen.getByRole('button', { name: /reminder · CLAUDE.md/ })).toBeTruthy()
  expect(screen.getByText(/request captured/)).toBeTruthy()
  expect(screen.getAllByRole('link', { name: /open raw/ }).length).toBeGreaterThan(0)
})

it('expands and collapses thinking and unpaired results with the corresponding filters', () => {
  const item = exchange('first', 1)
  item.parts = [
    { kind: 'thinking', role: 'assistant', text: 'Planning' },
    { kind: 'result', role: 'tool', text: 'Result' },
  ]
  const view = render(<SessionTranscriptView exchanges={[item]} filters={filters} />)
  const thinking = screen.getByText(/thinking ·/).closest('details')!
  const result = screen.getByText('tool result').closest('details')!
  expect(thinking.open).toBe(false)
  expect(result.open).toBe(false)
  view.rerender(<SessionTranscriptView exchanges={[item]} filters={{ ...filters, thinking: true, results: true }} />)
  expect(thinking.open).toBe(true)
  expect(result.open).toBe(true)
  view.rerender(<SessionTranscriptView exchanges={[item]} filters={filters} />)
  expect(thinking.open).toBe(false)
  expect(result.open).toBe(false)
})
