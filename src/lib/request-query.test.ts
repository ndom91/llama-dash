// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { api, type ApiRequest } from './api'
import { qk, requestQueryOptions, useRequest, useRequestPayloads } from './queries'

function summary(id: string): ApiRequest {
  return {
    id,
    startedAt: '2026-10-26T12:00:00.000Z',
    durationMs: 1500,
    requestClass: 'inference',
    method: 'POST',
    endpoint: '/v1/chat/completions',
    model: 'test-model',
    statusCode: 200,
    promptTokens: 100,
    completionTokens: 20,
    totalTokens: 120,
    cacheCreationTokens: null,
    cacheReadTokens: null,
    costUsd: null,
    streamed: false,
    error: null,
    keyName: null,
    clientHost: 'test-client',
    clientName: null,
    endUserId: null,
    sessionId: null,
    routingRuleName: null,
    routingActionType: null,
    routingAuthMode: null,
    routingPreserveAuthorization: false,
    routingTargetType: null,
    routingTargetBaseUrl: null,
    routingTargetCredentialId: null,
    routingRoutedModel: null,
    credentialInjectionJson: null,
  }
}

function detail(id: string) {
  const request = {
    ...summary(id),
    streamCloseMs: null,
    routingRuleId: null,
    routingRequestedModel: null,
    routingRejectReason: null,
  }
  return { request, prevId: null, nextId: null }
}

const clients: QueryClient[] = []

function pendingDetail() {
  let resolve!: (value: ReturnType<typeof detail>) => void
  const promise = new Promise<ReturnType<typeof detail>>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  clients.push(client)
  const wrapper = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client }, children)
  return { client, wrapper }
}

afterEach(() => {
  cleanup()
  for (const client of clients) client.clear()
  clients.length = 0
  vi.restoreAllMocks()
})

describe('request detail loading', () => {
  it('shows a paginated list summary immediately without storing it as complete detail', async () => {
    const { client, wrapper } = setup()
    client.setQueryData(qk.requestsList, {
      pages: [{ requests: [summary('req_other')] }, { requests: [summary('req_current')] }],
      pageParams: [undefined, 'cursor'],
    })
    const pending = pendingDetail()
    vi.spyOn(api, 'getRequestMetadata').mockReturnValue(pending.promise)
    const { result } = renderHook(() => useRequest('req_current'), { wrapper })

    expect(result.current.data?.request).toMatchObject(summary('req_current'))
    expect(result.current.isPlaceholderData).toBe(true)
    expect(client.getQueryData(qk.request('req_current'))).toBeUndefined()

    await act(async () => pending.resolve(detail('req_current')))
    await waitFor(() => expect(result.current.isPlaceholderData).toBe(false))
    expect(result.current.data?.request.model).toBe('test-model')
  })

  it('also reuses recent-request summaries', () => {
    const { client, wrapper } = setup()
    client.setQueryData([...qk.requestsRecent(10), false], [summary('req_recent')])
    vi.spyOn(api, 'getRequestMetadata').mockReturnValue(new Promise(() => {}))
    const { result } = renderHook(() => useRequest('req_recent'), { wrapper })
    expect(result.current.data?.request.id).toBe('req_recent')
    expect(result.current.isPlaceholderData).toBe(true)
  })

  it('never keeps the previous request under a different request ID', () => {
    const { client, wrapper } = setup()
    client.setQueryData(qk.request('req_old'), detail('req_old'))
    client.setQueryData(qk.requestsList, { pages: [{ requests: [summary('req_new')] }] })
    vi.spyOn(api, 'getRequestMetadata').mockReturnValue(new Promise(() => {}))
    const { result, rerender } = renderHook(({ id }) => useRequest(id), {
      wrapper,
      initialProps: { id: 'req_old' },
    })
    rerender({ id: 'req_new' })
    expect(result.current.data?.request.id).toBe('req_new')
    expect(result.current.data?.request).not.toHaveProperty('responseBody')
    rerender({ id: 'req_unknown' })
    expect(result.current.data).toBeUndefined()
    expect(result.current.isPending).toBe(true)
  })

  it('deduplicates pending prefetches and reuses completed detail', async () => {
    const { client, wrapper } = setup()
    const pending = pendingDetail()
    const fetch = vi.spyOn(api, 'getRequestMetadata').mockReturnValue(pending.promise)
    const prefetch = client.prefetchQuery(requestQueryOptions('req_prefetched'))
    const { result, unmount } = renderHook(() => useRequest('req_prefetched'), { wrapper })
    expect(fetch).toHaveBeenCalledTimes(1)
    await act(async () => {
      pending.resolve(detail('req_prefetched'))
      await prefetch
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    unmount()
    const cached = renderHook(() => useRequest('req_prefetched'), { wrapper })
    expect(cached.result.current.data).toEqual(detail('req_prefetched'))
    expect(cached.result.current.isFetching).toBe(false)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('reports fetch failures instead of leaving a summary in a loading state forever', async () => {
    const { client, wrapper } = setup()
    client.setQueryData(qk.requestsList, { pages: [{ requests: [summary('req_failed')] }] })
    vi.spyOn(api, 'getRequestMetadata').mockRejectedValue(new Error('404 Request not found'))
    const { result } = renderHook(() => useRequest('req_failed'), { wrapper })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error?.message).toContain('404')
    expect(result.current.isPlaceholderData).toBe(false)
  })

  it('loads metadata and payloads concurrently and preserves metadata on payload failure', async () => {
    const { wrapper } = setup()
    const metadata = vi.spyOn(api, 'getRequestMetadata').mockResolvedValue(detail('req_split'))
    const payloads = vi.spyOn(api, 'getRequestPayloads').mockRejectedValue(new Error('Payload unavailable'))
    const { result } = renderHook(
      () => ({ metadata: useRequest('req_split'), payloads: useRequestPayloads('req_split') }),
      { wrapper },
    )
    expect(metadata).toHaveBeenCalledOnce()
    expect(payloads).toHaveBeenCalledOnce()
    await waitFor(() => expect(result.current.payloads.isError).toBe(true))
    expect(result.current.metadata.data?.request.id).toBe('req_split')
    expect(result.current.metadata.isSuccess).toBe(true)
  })
})
