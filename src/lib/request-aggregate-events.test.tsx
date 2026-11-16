// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import * as v from 'valibot'
import { expect, it, vi } from 'vitest'
import { qk } from './query-keys'
import { ApiRequestSchema } from './schemas/request'
import { useAdminEvents } from './use-admin-events'

it('coalesces live chart and match-count refreshes and clears pending work on unmount', () => {
  vi.useFakeTimers()
  let source: EventTarget | undefined
  vi.stubGlobal(
    'EventSource',
    class extends EventTarget {
      static CLOSED = 2
      readyState = 1
      constructor() {
        super()
        source = this
      }
      close() {}
    },
  )
  const client = new QueryClient()
  const invalidate = vi.spyOn(client, 'invalidateQueries')
  const wrapper = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client }, children)
  const { unmount } = renderHook(useAdminEvents, { wrapper })
  const request = v.parse(ApiRequestSchema, {
    ...Object.fromEntries(Object.keys(ApiRequestSchema.entries).map((key) => [key, null])),
    id: 'req_live',
    startedAt: new Date().toISOString(),
    durationMs: 100,
    requestClass: 'inference',
    method: 'POST',
    endpoint: '/v1/chat/completions',
    statusCode: 200,
    streamed: false,
    routingPreserveAuthorization: false,
  })
  const emit = () => source?.dispatchEvent(new MessageEvent('request.completed', { data: JSON.stringify({ request }) }))
  const count = (key: readonly string[]) =>
    invalidate.mock.calls.filter(([options]) => options?.queryKey === key).length
  try {
    act(() => {
      for (let i = 0; i < 20; i++) emit()
    })
    act(() => vi.advanceTimersByTime(4999))
    expect(count(qk.requestCount)).toBe(0)
    expect(count(qk.requestHistogram)).toBe(0)
    act(() => vi.advanceTimersByTime(1))
    expect(count(qk.requestCount)).toBe(1)
    expect(count(qk.requestHistogram)).toBe(1)
    act(emit)
    unmount()
    act(() => vi.advanceTimersByTime(5000))
    expect(count(qk.requestCount)).toBe(1)
  } finally {
    unmount()
    client.clear()
    vi.unstubAllGlobals()
    vi.useRealTimers()
  }
})
