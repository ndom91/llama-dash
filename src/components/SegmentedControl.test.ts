// @vitest-environment jsdom
import { cleanup, fireEvent, render } from '@testing-library/react'
import { createElement, useState } from 'react'
import { afterEach, expect, it } from 'vitest'
import { SegmentedControl } from './SegmentedControl'

const OPTIONS = [
  { value: 'a', label: 'First' },
  { value: 'b', label: 'Second' },
] as const

afterEach(cleanup)

it('keeps the selected value and indicator in sync when an option is changed', () => {
  function Example() {
    const [value, setValue] = useState<'a' | 'b'>('a')
    return createElement(SegmentedControl<'a' | 'b'>, {
      legend: 'Example',
      options: OPTIONS,
      value,
      onChange: setValue,
    })
  }
  const view = render(createElement(Example))
  const first = view.getByRole('button', { name: 'First' })
  const second = view.getByRole('button', { name: 'Second' })
  expect(first.getAttribute('aria-pressed')).toBe('true')
  expect(view.container.querySelector('.t-tabs-pill')?.getAttribute('data-ready')).toBe('true')
  fireEvent.click(second)
  expect(first.getAttribute('aria-pressed')).toBe('false')
  expect(second.getAttribute('aria-pressed')).toBe('true')
})
