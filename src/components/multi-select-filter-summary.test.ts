import { expect, it } from 'vitest'
import { ALL_SET_FILTER, setFilterFromChecked } from '../lib/request-filters'
import { summarizeSetFilter } from './multi-select-filter-summary'

const names = ['proxy', 'ask-pebble', 'dev', 'prod', 'home', 'web', 'cli', 'bot', 'ci', 'ops', 'qa']
const options = names.map((n) => ({ value: n, label: n }))
const values = options.map((o) => o.value)
const summary = (checked: string[]) =>
  summarizeSetFilter(options, setFilterFromChecked(values, new Set(checked)), 'keys')

it('describes each selection state', () => {
  expect(summarizeSetFilter(options, ALL_SET_FILTER, 'keys')).toEqual({ label: 'All keys', tone: 'idle' })
  expect(summary(names.filter((n) => n !== 'dev'))).toEqual({
    label: 'All except dev',
    badge: '10/11',
    tone: 'active',
  })
  expect(summary(['proxy', 'ask-pebble'])).toEqual({ label: 'proxy, ask-pebble', badge: '2/11', tone: 'active' })
  expect(summary(names.slice(0, 6))).toEqual({ label: '6 of 11 keys', badge: '6/11', tone: 'active' })
  expect(summary([])).toEqual({ label: 'No keys', badge: '0', tone: 'empty' })
})

it('names the checked option of a two-option filter', () => {
  const routing = [
    { value: 'routed', label: 'Routed' },
    { value: 'unrouted', label: 'Unrouted' },
  ]
  expect(summarizeSetFilter(routing, { mode: 'exclude', values: ['unrouted'] }, 'routing', 'All requests').label).toBe(
    'Routed',
  )
})
