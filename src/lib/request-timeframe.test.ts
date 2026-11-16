import * as v from 'valibot'
import { RequestTimeFilterSchema } from './schemas/request-search'
import { expect, it } from 'vitest'
import { validateRequestsSearch } from '../features/requests/requestsSearch'
import {
  localDateTime,
  parseLocalDateTime,
  requestMatchesTimeframe,
  mergeRequestIntervals,
  requestMatchesIntervals,
  requestTimeBounds,
} from './request-timeframe'

it('keeps all-history unbounded and resolves rolling windows at query time', () => {
  expect(requestTimeBounds({})).toEqual({ from: undefined, to: undefined })
  expect(requestTimeBounds({ timeframe: '3h' }, 20_000_000)).toEqual({ from: 9_200_000, to: 20_000_001 })
  expect(requestTimeBounds({ timeframe: '3h' }, 21_000_000)).toEqual({ from: 10_200_000, to: 21_000_001 })
  const filter = { timeframe: 'custom' as const, from: 1000, to: 2000 }
  expect(requestMatchesTimeframe(new Date(1000).toISOString(), filter)).toBe(true)
  expect(requestMatchesTimeframe(new Date(2000).toISOString(), filter)).toBe(false)
})

it('validates fixed range links without silently accepting partial or reversed ranges', () => {
  expect(validateRequestsSearch({ timeframe: 'custom', from: '1000', to: '2000' })).toMatchObject({
    timeframe: 'custom',
    from: 1000,
    to: 2000,
  })
  for (const input of [
    { timeframe: 'custom', from: 2000, to: 1000 },
    { timeframe: 'custom', from: 1000 },
    { timeframe: '1h', from: 1000, to: 2000 },
    { timeframe: 'invalid' },
    { timeframe: 'custom', from: 1, to: Infinity },
  ])
    expect(v.safeParse(RequestTimeFilterSchema, input).success).toBe(false)
})

it('round-trips local input and rejects nonexistent calendar dates', () => {
  const time = parseLocalDateTime('2026-11-16T13:30')!
  expect(localDateTime(time)).toBe('2026-11-16T13:30')
  expect(parseLocalDateTime('2026-02-30T12:00')).toBeNull()
  expect(parseLocalDateTime('bad')).toBeNull()
})

it('merges adjacent selections while retaining disjoint ranges and exclusive ends', () => {
  const ranges = mergeRequestIntervals([
    { from: 10, to: 20 },
    { from: 0, to: 10 },
    { from: 30, to: 40 },
  ])
  expect(ranges).toEqual([
    { from: 0, to: 20 },
    { from: 30, to: 40 },
  ])
  expect(requestMatchesIntervals(20, ranges)).toBe(false)
  expect(requestMatchesIntervals(30, ranges)).toBe(true)
})
