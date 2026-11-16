// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { expect, it, vi } from 'vitest'

const listRequests = vi.hoisted(() => vi.fn())
vi.mock('./api', () => ({ api: { listRequests } }))

import { useRequestsList } from './queries'

it('grows sparse filtered pages, caps them, and resets after a match', async () => {
  const limits: number[] = []
  listRequests.mockImplementation(async ({ limit }: { limit: number }) => {
    limits.push(limit)
    const match = limits.length === 5
    return { requests: [{ id: match ? 'match' : 'other' }], nextCursor: `cursor_${limits.length}`, mcpHiddenCount: 0 }
  })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client }, children)
  const { result, unmount } = renderHook(
    () => useRequestsList([], 'all', (rows) => rows.some((row) => row.id === 'match')),
    { wrapper },
  )
  try {
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    for (let i = 0; i < 5; i++) await act(async () => void (await result.current.fetchNextPage()))
    expect(limits).toEqual([50, 100, 200, 400, 500, 50])
    expect(
      client
        .getQueryData<{ pageParams: { limit: number }[] }>(['requests', 'list'])
        ?.pageParams.map((page) => page.limit),
    ).toEqual(limits)
  } finally {
    unmount()
    client.clear()
    listRequests.mockReset()
  }
})
