// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'

const viewport = vi.hoisted(() => ({ mobile: false }))
vi.mock('../../lib/use-media-query', () => ({ useMediaQuery: () => viewport.mobile }))

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a href="/request">{children}</a>,
}))
vi.mock('../../lib/api', () => ({
  api: {
    getRequestSession: vi.fn(async () => ({
      sessionId: 'session-1',
      nextCursor: null,
      requests: [
        {
          id: 'req_1',
          startedAt: '2026-01-01T00:00:00Z',
          model: 'codex',
          statusCode: 200,
          durationMs: 10,
          totalTokens: 1,
          streamed: true,
          error: null,
          payloads: {
            requestBody: '{"instructions":"captured prefix\n...[truncated 3 bytes]',
            responseBody: 'data: {"type":"unknown","value":"captured event"}\n\n',
          },
        },
      ],
    })),
  },
}))

import { cleanup } from '@testing-library/react'
import { api } from '../../lib/api'
import { SessionPage } from './SessionPage'
import { SessionPagePending } from './SessionPagePending'

afterEach(() => {
  cleanup()
  viewport.mobile = false
})

it('reveals captured bodies when no messages can be reconstructed', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <SessionPage id="req_1" />
    </QueryClientProvider>,
  )
  const request = await screen.findByText('View captured request body')
  fireEvent.click(request)
  await waitFor(() => expect(screen.getByText(/captured prefix/)).toBeTruthy())
  fireEvent.click(screen.getByText('View captured response body'))
  await waitFor(() => expect(screen.getByText(/captured event/)).toBeTruthy())
  client.clear()
})

it('shows the same accessible responsive skeleton during navigation and initial loading', async () => {
  const pending = render(<SessionPagePending />)
  const status = pending.getByRole('status', { name: 'Loading session history' })
  expect(status.querySelectorAll('.rounded.border.border-border')).toHaveLength(2)
  expect(status.querySelector('[aria-hidden="true"]')?.className).toContain('min-w-0')
  expect(status.querySelector('.grid')?.className).toContain('max-sm:grid-cols-1')
  pending.unmount()

  vi.mocked(api.getRequestSession).mockImplementationOnce(() => new Promise(() => {}))
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const loading = render(
    <QueryClientProvider client={client}>
      <SessionPage id="req_1" />
    </QueryClientProvider>,
  )
  expect(loading.getByRole('status', { name: 'Loading session history' })).toBeTruthy()
  expect(loading.queryByText('No session ID was captured for this request.')).toBeNull()
  loading.unmount()
  client.clear()
})

it('keeps existing requests visible while loading the next page', async () => {
  const first = await api.getRequestSession('req_1')
  vi.mocked(api.getRequestSession)
    .mockResolvedValueOnce({ ...first, nextCursor: 'cursor' })
    .mockImplementationOnce(() => new Promise(() => {}))
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const view = render(
    <QueryClientProvider client={client}>
      <SessionPage id="req_1" />
    </QueryClientProvider>,
  )
  fireEvent.click(await view.findByRole('button', { name: 'Load more requests' }))
  expect(await view.findByRole('status', { name: 'Loading more session requests' })).toBeTruthy()
  expect(view.getByText(/#1 · req_1/)).toBeTruthy()
  view.unmount()
  client.clear()
})

it('loads the newest requests first on mobile and appends older pages without repeating context', async () => {
  viewport.mobile = true
  const first = await api.getRequestSession('req_1')
  const base = first.requests[0]
  const olderBody = JSON.stringify({ input: [{ role: 'user', content: 'earlier question' }] })
  const newerBody = JSON.stringify({
    input: [
      { role: 'user', content: 'earlier question' },
      { role: 'assistant', content: 'earlier answer' },
      { role: 'user', content: 'latest question' },
    ],
  })
  const older = {
    ...base,
    id: 'req_old',
    streamed: false,
    payloads: {
      requestBody: olderBody,
      responseBody: JSON.stringify({ output_text: 'earlier answer' }),
    },
  }
  const newer = {
    ...base,
    id: 'req_new',
    streamed: false,
    payloads: {
      requestBody: newerBody,
      responseBody: JSON.stringify({ output_text: 'latest answer' }),
    },
  }
  vi.mocked(api.getRequestSession)
    .mockResolvedValueOnce({ ...first, requests: [newer], nextCursor: 'req_new', olderContext: older })
    .mockResolvedValueOnce({ ...first, requests: [older], nextCursor: null, olderContext: null })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const view = render(
    <QueryClientProvider client={client}>
      <SessionPage id="req_1" />
    </QueryClientProvider>,
  )
  expect(await view.findByText('latest answer')).toBeTruthy()
  expect(view.queryByText('earlier question')).toBeNull()
  const card = view.getByRole('region', { name: 'Request 1' })
  expect(card.textContent!.indexOf('latest answer')).toBeLessThan(card.textContent!.indexOf('latest question'))
  const button = view.getByRole('button', { name: 'Load older requests' })
  expect(vi.mocked(api.getRequestSession)).toHaveBeenLastCalledWith('req_1', undefined, expect.anything(), 'desc')
  fireEvent.click(button)
  expect(await view.findByText('earlier question')).toBeTruthy()
  const cards = view.getAllByRole('region', { name: /Request [12]/ })
  expect(cards[0].textContent).toContain('req_new')
  expect(cards[1].textContent).toContain('req_old')
  expect(vi.mocked(api.getRequestSession)).toHaveBeenLastCalledWith('req_1', 'req_new', expect.anything(), 'desc')
  expect(view.getAllByText('earlier question')).toHaveLength(1)
  view.unmount()
  client.clear()
})
