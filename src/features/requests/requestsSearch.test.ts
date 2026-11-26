import { describe, expect, it } from 'vitest'
import { ALL_SET_FILTER } from '../../lib/request-filters'
import { setFilterFromSearch, setFilterSearchPatch, validateRequestsSearch } from './requestsSearch'

describe('validateRequestsSearch multi-select filters', () => {
  it('keeps legacy single-value and list inclusion links working', () => {
    const search = validateRequestsSearch({ key: 'key:proxy', model: ['a', 'b'] })
    expect(setFilterFromSearch(search, 'key')).toEqual({ mode: 'include', values: ['key:proxy'] })
    expect(setFilterFromSearch(search, 'model')).toEqual({ mode: 'include', values: ['a', 'b'] })
  })

  it('migrates the legacy single routing value', () => {
    expect(setFilterFromSearch(validateRequestsSearch({ routing: 'routed' }), 'routing')).toEqual({
      mode: 'include',
      values: ['routed'],
    })
    expect(setFilterFromSearch(validateRequestsSearch({ routing: 'all' }), 'routing')).toEqual(ALL_SET_FILTER)
    expect(setFilterFromSearch(validateRequestsSearch({ routing: 'bogus' }), 'routing')).toEqual(ALL_SET_FILTER)
  })

  it('reads exclusion lists', () => {
    const search = validateRequestsSearch({ key_not: ['key:dev'], routing_not: ['unrouted'] })
    expect(setFilterFromSearch(search, 'key')).toEqual({ mode: 'exclude', values: ['key:dev'] })
    expect(setFilterFromSearch(search, 'routing')).toEqual({ mode: 'exclude', values: ['unrouted'] })
  })

  it('keeps an explicit empty inclusion as "nothing selected"', () => {
    expect(setFilterFromSearch(validateRequestsSearch({ host: [] }), 'host')).toEqual({ mode: 'include', values: [] })
    expect(setFilterFromSearch(validateRequestsSearch({ host_not: [] }), 'host')).toEqual(ALL_SET_FILTER)
  })

  it('treats a missing param as everything selected', () => {
    expect(setFilterFromSearch(validateRequestsSearch({}), 'model')).toEqual(ALL_SET_FILTER)
  })
})

describe('setFilterSearchPatch', () => {
  it('round-trips each mode through the URL', () => {
    for (const filter of [
      ALL_SET_FILTER,
      { mode: 'exclude' as const, values: ['key:dev'] },
      { mode: 'include' as const, values: ['key:a', 'key:b'] },
      { mode: 'include' as const, values: [] },
    ]) {
      const patch = setFilterSearchPatch('key', filter)
      const urlState = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined))
      expect(setFilterFromSearch(validateRequestsSearch(urlState), 'key')).toEqual(filter)
    }
  })

  it('clears the other side when switching modes', () => {
    expect(setFilterSearchPatch('key', { mode: 'include', values: ['key:a'] })).toEqual({
      key: ['key:a'],
      key_not: undefined,
    })
    expect(setFilterSearchPatch('key', ALL_SET_FILTER)).toEqual({ key: undefined, key_not: undefined })
  })
})
