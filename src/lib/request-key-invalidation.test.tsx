// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { expect, it, vi } from 'vitest'
import { api } from './api'
import { qk, useDeleteApiKey, useRenameApiKey } from './queries'

it.each(['rename', 'delete'] as const)('invalidates request caches after key %s', async (action) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const keys = [
    qk.keys,
    qk.requestsList,
    [...qk.requestsFilteredList, '', 'all'],
    qk.requestsRecent(10),
    qk.requestFilterOptions,
  ]
  for (const key of keys) client.setQueryData(key, {})
  const wrapper = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client }, children)
  const rename = vi.spyOn(api, 'renameKey').mockResolvedValue({ ok: true })
  const remove = vi.spyOn(api, 'deleteKey').mockResolvedValue({ ok: true })
  const { result, unmount } = renderHook(() => ({ rename: useRenameApiKey(), remove: useDeleteApiKey() }), { wrapper })
  try {
    await act(async () => {
      if (action === 'rename') await result.current.rename.mutateAsync({ id: 'key_1', name: 'new' })
      else await result.current.remove.mutateAsync('key_1')
    })
    for (const key of keys) expect(client.getQueryState(key)?.isInvalidated).toBe(true)
  } finally {
    unmount()
    client.clear()
    rename.mockRestore()
    remove.mockRestore()
  }
})
