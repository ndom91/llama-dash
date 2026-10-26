import * as v from 'valibot'
import { afterEach, expect, it, vi } from 'vitest'
import { JsonValidatorCache } from './json-validator-cache'

const schema = v.object({ value: v.number() })
afterEach(() => vi.useRealTimers())

it('evicts least recently used entries at the entry and byte budgets', () => {
  const cache = new JsonValidatorCache({ entries: 2, bytes: 10, maxAgeMs: 1000 })
  cache.set('a', schema, { value: 1 }, 'a', 4)
  cache.set('b', schema, { value: 2 }, 'b', 4)
  expect(cache.get('a', schema)?.data.value).toBe(1)
  cache.set('c', schema, { value: 3 }, 'c', 4)
  expect(cache.get('b', schema)).toBeUndefined()
  cache.set('large', schema, { value: 4 }, 'large', 9)
  expect(cache.get('a', schema)).toBeUndefined()
  expect(cache.get('c', schema)).toBeUndefined()
  expect(cache.get('large', schema)?.etag).toBe('large')
})

it('skips oversized entries and expires entries without extending their lifetime on reads', () => {
  vi.useFakeTimers()
  const cache = new JsonValidatorCache({ entries: 2, bytes: 10, maxAgeMs: 1000 })
  cache.set('huge', schema, { value: 1 }, 'huge', 11)
  expect(cache.get('huge', schema)).toBeUndefined()
  cache.set('a', schema, { value: 1 }, 'a', 2)
  vi.advanceTimersByTime(900)
  expect(cache.get('a', schema)).toBeDefined()
  vi.advanceTimersByTime(100)
  expect(cache.get('a', schema)).toBeUndefined()
})

it('does not reuse data across schema changes and supports explicit clearing', () => {
  const cache = new JsonValidatorCache()
  cache.set('a', schema, { value: 1 }, 'a', 2)
  expect(cache.get('a', v.object({ value: v.string() }))).toBeUndefined()
  cache.set('a', schema, { value: 1 }, 'a', 2)
  cache.clear()
  expect(cache.get('a', schema)).toBeUndefined()
})
