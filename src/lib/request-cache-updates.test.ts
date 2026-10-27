import { QueryClient, QueryObserver } from '@tanstack/react-query'
import { expect, it } from 'vitest'
import { qk, REQUESTS_PAGE_SIZE } from './queries'
import { resyncLiveQueries, updateRequestsListCache, trimInactiveRequestPayloads } from './request-cache-updates'
import type { ApiRequest } from './schemas/request'

const row = (n: number) => ({ id: `req_${String(n).padStart(6, '0')}`, requestClass: 'inference' }) as ApiRequest

it('bounds live insertions, rebalances pages, and preserves pagination continuity', () => {
  const client = new QueryClient()
  const first = Array.from({ length: REQUESTS_PAGE_SIZE }, (_, i) => row(100 - i))
  const second = Array.from({ length: REQUESTS_PAGE_SIZE }, (_, i) => row(50 - i))
  client.setQueryData(qk.requestsList, {
    pages: [
      { requests: first, nextCursor: first.at(-1)!.id },
      { requests: second, nextCursor: second.at(-1)!.id },
    ],
    pageParams: [undefined, first.at(-1)!.id],
  })
  for (let n = 101; n <= 1000; n++) updateRequestsListCache(client, row(n))
  const data = client.getQueryData<{ pages: { requests: ApiRequest[]; nextCursor: string }[]; pageParams: unknown[] }>(
    qk.requestsList,
  )!
  expect(data.pages.map((page) => page.requests.length)).toEqual([50, 50])
  expect(data.pages[0].requests[0].id).toBe(row(1000).id)
  expect(data.pages[1].requests.at(-1)!.id).toBe(row(901).id)
  expect(data.pageParams[1]).toBe(data.pages[0].nextCursor)
  expect(data.pages[1].nextCursor).toBe(row(901).id)
  updateRequestsListCache(client, row(1000))
  expect(client.getQueryData(qk.requestsList)).toBe(data)
  client.clear()
})

it('retains an exhausted cursor until an insertion actually drops a row', () => {
  const client = new QueryClient()
  client.setQueryData(qk.requestsList, { pages: [{ requests: [row(1)], nextCursor: null }], pageParams: [undefined] })
  for (let n = 2; n <= 50; n++) updateRequestsListCache(client, row(n))
  const read = () => client.getQueryData<{ pages: { nextCursor: string | null }[] }>(qk.requestsList)!
  expect(read().pages[0].nextCursor).toBeNull()
  updateRequestsListCache(client, row(51))
  expect(read().pages[0].nextCursor).toBe(row(2).id)
  client.clear()
})

it('updates only filtered lists matching the completed request minute', () => {
  const client = new QueryClient()
  const matching = ['requests', 'filtered-list', '1800000']
  const other = ['requests', 'filtered-list', '1860000']
  for (const key of [matching, other])
    client.setQueryData(key, { pages: [{ requests: [], nextCursor: null }], pageParams: [undefined] })
  updateRequestsListCache(client, { ...row(1), startedAt: new Date(1_859_999).toISOString() })
  expect(client.getQueryData<{ pages: { requests: ApiRequest[] }[] }>(matching)?.pages[0].requests).toHaveLength(1)
  expect(client.getQueryData<{ pages: { requests: ApiRequest[] }[] }>(other)?.pages[0].requests).toHaveLength(0)
  client.clear()
})

it('resyncs live data without invalidating completed metadata or captured payloads', () => {
  const client = new QueryClient()
  for (const key of [
    qk.requestsList,
    qk.requestStats,
    qk.request('req_done'),
    qk.requestPayloads('req_done'),
    qk.models,
  ]) {
    client.setQueryData(key, {})
  }
  resyncLiveQueries(client)
  expect(client.getQueryState(qk.requestsList)?.isInvalidated).toBe(true)
  expect(client.getQueryState(qk.requestStats)?.isInvalidated).toBe(true)
  expect(client.getQueryState(qk.models)?.isInvalidated).toBe(true)
  expect(client.getQueryState(qk.request('req_done'))?.isInvalidated).toBe(false)
  expect(client.getQueryState(qk.requestPayloads('req_done'))?.isInvalidated).toBe(false)
  client.clear()
})

it('bounds retained payload count/bytes without evicting the active request', () => {
  const client = new QueryClient()
  for (let i = 0; i < 10; i++) client.setQueryData(qk.requestPayloads(`req_${i}`), { responseBody: 'x' })
  trimInactiveRequestPayloads(client)
  expect(client.getQueryCache().findAll({ queryKey: qk.requestPayloadsRoot })).toHaveLength(8)
  const key = qk.requestPayloads('req_active')
  client.setQueryData(key, { responseBody: 'x'.repeat(9 * 1024 * 1024) })
  const observer = new QueryObserver(client, { queryKey: key, enabled: false })
  const unsubscribe = observer.subscribe(() => {})
  trimInactiveRequestPayloads(client)
  expect(client.getQueryData(key)).toBeDefined()
  expect(client.getQueryCache().findAll({ queryKey: qk.requestPayloadsRoot })).toHaveLength(1)
  unsubscribe()
  trimInactiveRequestPayloads(client)
  expect(client.getQueryData(key)).toBeUndefined()
  client.clear()
})
