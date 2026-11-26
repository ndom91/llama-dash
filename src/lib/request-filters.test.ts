import { describe, expect, it } from 'vitest'
import {
  ALL_SET_FILTER,
  applyRequestFilters,
  isSetFilterActive,
  requestKeyFilterLabel,
  requestKeyNameFilterValue,
  REQUEST_KEY_FILTER_NONE,
  type SetFilter,
  setFilterFromChecked,
  setFilterMatches,
} from './request-filters'

const OPTIONS = ['a', 'b', 'c', 'd', 'e', 'f']
const checkedExcept = (...unchecked: string[]) => new Set(OPTIONS.filter((o) => !unchecked.includes(o)))

describe('setFilterFromChecked', () => {
  it('turns the filter off when everything is checked', () => {
    expect(setFilterFromChecked(OPTIONS, new Set(OPTIONS))).toEqual(ALL_SET_FILTER)
    expect(isSetFilterActive(ALL_SET_FILTER)).toBe(false)
  })

  it('stores an exclusion while half or fewer are unchecked', () => {
    expect(setFilterFromChecked(OPTIONS, checkedExcept('b'))).toEqual({ mode: 'exclude', values: ['b'] })
    expect(setFilterFromChecked(OPTIONS, checkedExcept('a', 'b', 'c'))).toEqual({
      mode: 'exclude',
      values: ['a', 'b', 'c'],
    })
  })

  it('switches to an inclusion once more than half are unchecked', () => {
    expect(setFilterFromChecked(OPTIONS, checkedExcept('a', 'b', 'c', 'd'))).toEqual({
      mode: 'include',
      values: ['e', 'f'],
    })
  })

  it('stores nothing selected as an empty inclusion', () => {
    const none = setFilterFromChecked(OPTIONS, new Set())
    expect(none).toEqual({ mode: 'include', values: [] })
    expect(isSetFilterActive(none)).toBe(true)
    expect(setFilterMatches(none, () => true)).toBe(false)
  })
})

describe('setFilterMatches', () => {
  it('includes options added after an exclusion was saved', () => {
    const saved = setFilterFromChecked(OPTIONS, checkedExcept('b'))
    expect(setFilterMatches(saved, (v) => v === 'new-option')).toBe(true)
    expect(setFilterMatches(saved, (v) => v === 'b')).toBe(false)
  })

  it('leaves options added after an inclusion was saved out', () => {
    const saved = setFilterFromChecked(OPTIONS, new Set(['a']))
    expect(setFilterMatches(saved, (v) => v === 'new-option')).toBe(false)
    expect(setFilterMatches(saved, (v) => v === 'a')).toBe(true)
  })
})

describe('applyRequestFilters', () => {
  const row = (id: string, model: string | null, keyName: string | null) => ({
    id,
    statusCode: 200,
    model,
    keyName,
    routingAuthMode: null,
    routingActionType: null,
    clientName: null,
    clientHost: null,
    endUserId: null,
    sessionId: null,
    endpoint: '/v1/chat/completions',
    method: 'POST',
  })
  const rows = [row('1', 'm1', 'dev'), row('2', 'm2', 'prod'), row('3', null, null)]
  const base = {
    statusFilter: 'all' as const,
    modelFilter: ALL_SET_FILTER,
    keyFilter: ALL_SET_FILTER,
    routingFilter: ALL_SET_FILTER,
    hostFilter: ALL_SET_FILTER,
    clientFilter: '',
    endUserFilter: '',
    sessionFilter: '',
    search: '',
  }
  const ids = (filters: Partial<typeof base>) => applyRequestFilters(rows, { ...base, ...filters }).map((r) => r.id)
  const exc = (...values: string[]): SetFilter => ({ mode: 'exclude', values })

  it('keeps every row except the excluded key, including rows without a key', () => {
    expect(ids({ keyFilter: exc(requestKeyNameFilterValue('dev')) })).toEqual(['2', '3'])
    expect(ids({ keyFilter: exc(REQUEST_KEY_FILTER_NONE) })).toEqual(['1', '2'])
  })

  it('keeps rows without a model when excluding a model', () => {
    expect(ids({ modelFilter: exc('m1') })).toEqual(['2', '3'])
  })
})

it('labels stale key filter values by name', () => {
  expect(requestKeyFilterLabel(requestKeyNameFilterValue('domino-wire [dev]'))).toBe('domino-wire [dev]')
  expect(requestKeyFilterLabel(REQUEST_KEY_FILTER_NONE)).toBe('No key')
})
