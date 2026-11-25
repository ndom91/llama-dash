// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { createElement, type ReactNode } from 'react'
import { expect, it, vi } from 'vitest'
import type { RequestListQuery } from '../../lib/request-query-data'
import * as schema from '../db/schema'
import { createMigratedTestDb, insertTestRequests } from '../db/test-db'
import { ALL_SET_FILTER } from '../../lib/request-filters'

it('counts all matches independently of loaded pages and sorting, and refreshes for arrivals', async () => {
  const sqlite = createMigratedTestDb()
  const db = drizzle(sqlite, { schema })
  vi.doMock('../db/index.ts', () => ({ db, sqliteDb: sqlite, schema }))
  vi.doMock('./api-keys.ts', () => ({ getApiKeyNameMap: () => new Map(), getApiKeyName: () => null }))
  const base = Date.UTC(2026, 10, 1)
  insertTestRequests(
    sqlite,
    Array.from({ length: 323 }, (_, i) => ({
      id: `req_${String(i).padStart(4, '0')}`,
      startedAt: base + i,
      model: i < 123 ? 'target' : 'other',
      durationMs: i,
    })),
  )
  const { requestRoutes } = await import('./routes/requests')
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const request = new Request(new URL(url, 'http://dash.test'), init)
    const route = requestRoutes.find((r) => r.pattern.test(new URL(request.url).pathname))!
    return route.handler(request, [] as unknown as RegExpMatchArray)
  })
  vi.stubGlobal('fetch', fetchMock)
  const { useRequestCount, useRequestsList, qk } = await import('../../lib/queries')
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 30_000 } } })
  const wrapper = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client }, children)
  const filters: RequestListQuery = {
    search: '',
    modelFilter: { mode: 'include' as const, values: ['target'] },
    keyFilter: ALL_SET_FILTER,
    routingFilter: ALL_SET_FILTER,
    clientFilter: '',
    hostFilter: ALL_SET_FILTER,
    endUserFilter: '',
    sessionFilter: '',
    includeMcp: false,
    timeframe: 'custom',
    from: base,
    to: base + 1000,
    sortKey: 'startedAt',
    sortDir: 'desc',
  }
  const { result, rerender, unmount } = renderHook(
    (query: RequestListQuery) => ({
      list: useRequestsList([], 'all', query),
      count: useRequestCount(query, 'all'),
    }),
    { initialProps: filters, wrapper },
  )
  const countCalls = () => fetchMock.mock.calls.filter(([url]) => url.includes('/count')).length
  try {
    await waitFor(() => expect(result.current.count.data?.count).toBe(123))
    await waitFor(() => expect(result.current.list.isSuccess).toBe(true))
    expect(result.current.list.data?.pages[0].requests).toHaveLength(50)
    await act(async () => {
      await result.current.list.fetchNextPage()
    })
    await waitFor(() => expect(result.current.list.data?.pages).toHaveLength(2))
    expect(countCalls()).toBe(1)
    rerender({ ...filters, sortKey: 'durationMs', sortDir: 'asc' })
    await waitFor(() => expect(result.current.list.data?.pages[0].requests[0].durationMs).toBe(0))
    expect(countCalls()).toBe(1)
    insertTestRequests(sqlite, [{ id: 'req_live', startedAt: base + 900, model: 'target' }])
    await act(async () => {
      await client.invalidateQueries({ queryKey: qk.requestCount })
    })
    await waitFor(() => expect(result.current.count.data?.count).toBe(124))
    expect(countCalls()).toBe(2)
    rerender({ ...filters, ranges: [{ from: base, to: base + 10 }] })
    await waitFor(() => expect(result.current.count.data?.count).toBe(10))
  } finally {
    unmount()
    client.clear()
    vi.unstubAllGlobals()
    vi.doUnmock('../db/index.ts')
    vi.doUnmock('./api-keys.ts')
    sqlite.close()
  }
})
