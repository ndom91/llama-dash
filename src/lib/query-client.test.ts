import { type QueryClient, QueryObserver } from '@tanstack/react-query'
import { afterEach, expect, it, vi } from 'vitest'
import { createQueryClient } from './query-client'
import { qk } from './query-keys'

const clients: QueryClient[] = []
function client() {
  const value = createQueryClient()
  clients.push(value)
  return value
}
afterEach(() => {
  for (const value of clients) value.clear()
  clients.length = 0
})

it('installs the payload-success eviction policy in the actual factory', async () => {
  const qc = client()
  for (let i = 0; i < 10; i++) {
    await qc.fetchQuery({ queryKey: qk.requestPayloads(`req_${i}`), queryFn: async () => ({ responseBody: 'x' }) })
  }
  expect(qc.getQueryCache().findAll({ queryKey: qk.requestPayloadsRoot })).toHaveLength(8)
  expect(qc.getQueryData(qk.requestPayloads('req_0'))).toBeUndefined()
  expect(qc.getQueryData(qk.requestPayloads('req_9'))).toBeDefined()
})

it('retains an active oversized payload, then trims it when its observer leaves', async () => {
  const qc = client()
  const key = qk.requestPayloads('req_active')
  qc.setQueryData(key, { responseBody: 'x'.repeat(9 * 1024 * 1024) })
  const observer = new QueryObserver(qc, { queryKey: key, enabled: false })
  const unsubscribe = observer.subscribe(() => {})
  await qc.fetchQuery({ queryKey: qk.requestPayloads('req_other'), queryFn: async () => ({ responseBody: 'small' }) })
  expect(qc.getQueryData(key)).toBeDefined()
  unsubscribe()
  await Promise.resolve()
  expect(qc.getQueryData(key)).toBeUndefined()
})

it('keeps the destination query in the cache when an observer switches payloads under cache pressure', async () => {
  const qc = client()
  for (let i = 0; i < 8; i++) {
    qc.setQueryData(qk.requestPayloads(`req_cached_${i}`), { responseBody: 'small' })
  }
  const oldKey = qk.requestPayloads('req_old')
  const newKey = qk.requestPayloads('req_new')
  const queryFn = vi.fn(async () => ({ responseBody: 'small' }))
  const observer = new QueryObserver(qc, { queryKey: oldKey, queryFn, staleTime: 30_000 })
  const unsubscribe = observer.subscribe(() => {})
  await qc.fetchQuery({ queryKey: oldKey, queryFn })
  observer.setOptions({ queryKey: newKey, queryFn, staleTime: 30_000 })
  expect(qc.getQueryCache().find({ queryKey: newKey })).toBe(observer.getCurrentQuery())
  await Promise.resolve()
  expect(qc.getQueryCache().find({ queryKey: newKey })).toBe(observer.getCurrentQuery())
  await qc.fetchQuery({ queryKey: newKey, queryFn, staleTime: 30_000 })
  for (let i = 0; i < 10; i++) observer.setOptions({ queryKey: newKey, queryFn, staleTime: 30_000 })
  expect(queryFn).toHaveBeenCalledTimes(2)
  unsubscribe()
})

it('creates independent caches while preserving default fetching behavior', () => {
  const first = client()
  const second = client()
  first.setQueryData(qk.models, ['private'])
  expect(second.getQueryData(qk.models)).toBeUndefined()
  expect(first.getDefaultOptions().queries).toMatchObject({
    staleTime: 30_000,
    retry: 1,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })
})
