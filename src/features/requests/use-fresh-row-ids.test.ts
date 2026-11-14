// @vitest-environment jsdom
import { cleanup, renderHook } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { useFreshRowIds } from './use-fresh-row-ids'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

const row = (id: string) => ({ id })
const FILTERS_A = { status: 'all' }
const FILTERS_B = { status: 'err' }

function setup(rows: Array<{ id: string }>, resetKey: unknown = FILTERS_A) {
  return renderHook(({ rows, resetKey }) => useFreshRowIds(rows, resetKey), { initialProps: { rows, resetKey } })
}

it('marks nothing fresh on the first load', () => {
  const { result } = setup([row('req_03'), row('req_02'), row('req_01')])
  expect(result.current.size).toBe(0)
})

it('marks rows newer than any seen row as fresh', () => {
  const { result, rerender } = setup([row('req_02'), row('req_01')])
  rerender({ rows: [row('req_04'), row('req_03'), row('req_02'), row('req_01')], resetKey: FILTERS_A })
  expect([...result.current].sort()).toEqual(['req_03', 'req_04'])
})

it('does not mark older pages as fresh', () => {
  const { result, rerender } = setup([row('req_05'), row('req_04')])
  rerender({ rows: [row('req_05'), row('req_04'), row('req_03'), row('req_02')], resetKey: FILTERS_A })
  expect(result.current.size).toBe(0)
})

it('starts over when the reset key changes', () => {
  const { result, rerender } = setup([row('req_01')])
  rerender({ rows: [row('req_09'), row('req_01')], resetKey: FILTERS_B })
  expect(result.current.size).toBe(0)
})

it('drops rows once they are no longer fresh', () => {
  vi.useFakeTimers()
  const { result, rerender } = setup([row('req_01')])
  rerender({ rows: [row('req_02'), row('req_01')], resetKey: FILTERS_A })
  expect(result.current.has('req_02')).toBe(true)
  vi.advanceTimersByTime(2_000)
  rerender({ rows: [row('req_02'), row('req_01')], resetKey: FILTERS_A })
  expect(result.current.has('req_02')).toBe(false)
})
