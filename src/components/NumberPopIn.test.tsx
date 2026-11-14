// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { NumberPopIn } from './NumberPopIn'

afterEach(cleanup)

function digitGroup(container: HTMLElement) {
  return container.querySelector('.t-digit-group')
}

it('stays still on first render and exposes the whole value once', () => {
  const { container, getByText } = render(<NumberPopIn value="1,234" />)
  expect(digitGroup(container)?.classList.contains('is-animating')).toBe(false)
  expect(getByText('1,234').className).toBe('sr-only')
})

it('animates after the value changes', () => {
  const { container, rerender } = render(<NumberPopIn value="12" />)
  rerender(<NumberPopIn value="13" />)
  const group = digitGroup(container)
  expect(group?.classList.contains('is-animating')).toBe(true)
  expect([...(group?.querySelectorAll('.t-digit') ?? [])].map((digit) => digit.getAttribute('data-stagger'))).toEqual([
    '1',
    '2',
  ])
})
