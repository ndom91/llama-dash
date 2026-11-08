// @vitest-environment jsdom
import { cleanup, fireEvent, render } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { useRequestSwipe } from './useRequestSwipe'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function setup() {
  vi.stubGlobal('innerWidth', 390)
  const onNavigate = vi.fn()
  function Example() {
    return createElement(
      'div',
      { ...useRequestSwipe(onNavigate, true), 'data-testid': 'page' },
      createElement('div', { 'data-testid': 'content' }, 'payload'),
      createElement('button', { type: 'button' }, 'action'),
      createElement('div', { 'data-testid': 'scroller', style: { overflowX: 'auto' } }, 'scrollable'),
    )
  }
  return { ...render(createElement(Example)), onNavigate }
}

function swipe(target: Element, x: number, y: number, dx: number, dy: number) {
  fireEvent.touchStart(target, { touches: [{ clientX: x, clientY: y }] })
  fireEvent.touchEnd(target, { touches: [], changedTouches: [{ clientX: x + dx, clientY: y + dy }] })
}

it('navigates older on left swipes and newer on right swipes', () => {
  const view = setup()
  const content = view.getByTestId('content')
  swipe(content, 200, 100, -100, 10)
  swipe(content, 100, 100, 100, -10)
  expect(view.onNavigate.mock.calls).toEqual([['older'], ['newer']])
})

it('ignores vertical, short, edge, interactive, and horizontally scrollable gestures', () => {
  const view = setup()
  const content = view.getByTestId('content')
  swipe(content, 200, 100, -40, 0)
  swipe(content, 200, 100, -100, 90)
  swipe(content, 10, 100, 100, 0)
  swipe(view.getByRole('button'), 200, 100, -100, 0)
  const scroller = view.getByTestId('scroller')
  Object.defineProperties(scroller, { scrollWidth: { value: 500 }, clientWidth: { value: 200 } })
  swipe(scroller, 200, 100, -100, 0)
  expect(view.onNavigate).not.toHaveBeenCalled()
})

it('does not navigate after a gesture is cancelled', () => {
  const view = setup()
  const content = view.getByTestId('content')
  fireEvent.touchStart(content, { touches: [{ clientX: 200, clientY: 100 }] })
  fireEvent.touchCancel(content)
  fireEvent.touchEnd(content, { touches: [], changedTouches: [{ clientX: 100, clientY: 100 }] })
  expect(view.onNavigate).not.toHaveBeenCalled()
})
