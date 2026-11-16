// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { expect, it, vi } from 'vitest'
import { qk } from './query-keys'
import { useAdminEvents } from './use-admin-events'

it('invalidates request and key caches when another client changes key names', () => {
  class FakeEventSource extends EventTarget {
    static CLOSED = 2
    readyState = 1
    close() {}
  }
  let source: FakeEventSource | undefined
  vi.stubGlobal(
    'EventSource',
    class extends FakeEventSource {
      constructor() {
        super()
        source = this
      }
    },
  )
  const client = new QueryClient()
  const keys = [
    qk.keys,
    qk.requestsList,
    [...qk.requestsFilteredList, '', 'all'],
    qk.requestsRecent(10),
    qk.requestFilterOptions,
  ]
  for (const key of keys) client.setQueryData(key, {})
  const wrapper = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client }, children)
  const { unmount } = renderHook(() => useAdminEvents(), { wrapper })
  try {
    act(() => source?.dispatchEvent(new Event('key.names.changed')))
    for (const key of keys) expect(client.getQueryState(key)?.isInvalidated).toBe(true)
  } finally {
    unmount()
    client.clear()
    vi.unstubAllGlobals()
  }
})
