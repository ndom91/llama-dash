// @vitest-environment jsdom
import { cleanup, fireEvent, render } from '@testing-library/react'
import { createElement, useState } from 'react'
import { afterEach, expect, it } from 'vitest'
import { Tabs } from './Tabs'

const ITEMS = [
  { id: 'one', label: 'One' },
  { id: 'two', label: 'Two' },
] as const

afterEach(cleanup)

it('updates the selected tab and indicator', () => {
  function Example() {
    const [value, setValue] = useState<'one' | 'two'>('one')
    return createElement(Tabs<'one' | 'two'>, { items: ITEMS, value, onChange: setValue, variant: 'accent' })
  }
  const view = render(createElement(Example))
  const first = view.getByRole('tab', { name: 'One' })
  const second = view.getByRole('tab', { name: 'Two' })
  expect(view.container.querySelector('[data-ready="true"]')).toBeTruthy()
  fireEvent.click(second)
  expect(first.getAttribute('aria-selected')).toBe('false')
  expect(second.getAttribute('aria-selected')).toBe('true')
})
