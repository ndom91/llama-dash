// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a href="/request">{children}</a>,
}))
vi.mock('../../lib/api', () => ({
  api: {
    getRequestSession: async () => ({
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
    }),
  },
}))

import { cleanup } from '@testing-library/react'
import { SessionPage } from './SessionPage'

afterEach(cleanup)

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
