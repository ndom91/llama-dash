// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { createElement, type ReactNode } from 'react'
import { expect, it, vi } from 'vitest'
import * as schema from '../db/schema'
import { createMigratedTestDb, insertTestRequests } from '../db/test-db'

it('sends status and selected minutes through the client and route before paginating', async () => {
  const sqlite = createMigratedTestDb()
  const db = drizzle(sqlite, { schema })
  vi.doMock('../db/index.ts', () => ({ db, sqliteDb: sqlite, schema }))
  vi.doMock('./api-keys.ts', () => ({ getApiKeyNameMap: () => new Map(), getApiKeyName: () => null }))
  const base = 1_800_000
  insertTestRequests(sqlite, [
    ...Array.from({ length: 60 }, (_, i) => ({
      id: `req_z${String(i).padStart(3, '0')}`,
      startedAt: base + i,
      statusCode: 200,
    })),
    { id: 'req_a1', startedAt: base + 100, statusCode: 500 },
    { id: 'req_a2', startedAt: base + 200, statusCode: 404 },
    { id: 'req_a3', startedAt: base + 60_000, statusCode: 500 },
  ])
  const { requestRoutes } = await import('./routes/requests')
  const route = requestRoutes.find((entry) => entry.pattern.test('/api/requests'))!
  const fetchMock = vi.fn(async (url: string, options?: RequestInit) => {
    const request = new Request(new URL(url, 'http://dash.test'), options)
    return route.handler(request, ['/api/requests'] as unknown as RegExpMatchArray)
  })
  vi.stubGlobal('fetch', fetchMock)
  const { useRequestsList } = await import('../../lib/queries')
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client }, children)
  try {
    const { result, unmount } = renderHook(() => useRequestsList([base], 'err'), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.pages[0].requests.map((row) => row.id)).toEqual(['req_a2', 'req_a1'])
    const requestUrl = new URL(fetchMock.mock.calls[0][0], 'http://dash.test')
    expect(requestUrl.searchParams.get('status')).toBe('err')
    expect(requestUrl.searchParams.get('minutes')).toBe(String(base))
    unmount()
  } finally {
    client.clear()
    vi.unstubAllGlobals()
    vi.doUnmock('../db/index.ts')
    vi.doUnmock('./api-keys.ts')
    sqlite.close()
  }
})
