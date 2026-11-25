// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { expect, it, vi } from 'vitest'
import { api } from './api'
import { useRequestFilterOptions } from './queries'

it('retains loaded filter choices after a refresh failure and recovers on retry', async () => {
  const previous = { models: ['model-a'], keys: ['key-a'], hosts: ['host-a'], systemKeys: [] }
  const refreshed = { ...previous, models: ['model-a', 'model-b'] }
  const fetchOptions = vi
    .spyOn(api, 'requestFilterOptions')
    .mockResolvedValueOnce(previous)
    .mockRejectedValueOnce(new Error('Network unavailable'))
    .mockResolvedValueOnce(refreshed)
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client }, children)
  const { result, unmount } = renderHook(useRequestFilterOptions, { wrapper })
  try {
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    await act(async () => {
      await result.current.refetch()
    })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.data).toEqual(previous)
    await act(async () => {
      await result.current.refetch()
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(refreshed)
    expect(fetchOptions).toHaveBeenCalledTimes(3)
  } finally {
    unmount()
    client.clear()
    fetchOptions.mockRestore()
  }
})
