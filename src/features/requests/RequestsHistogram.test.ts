// @vitest-environment jsdom
import { cleanup, fireEvent, render } from '@testing-library/react'
import { createElement, useState } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { TooltipProvider } from '../../components/Tooltip'
import { RequestsHistogram } from './RequestsHistogram'

const buckets = [0, 1, 2, 3].map((n) => ({ timestamp: 1_800_000 + n * 60_000, total: n, errors: 0 }))

function TestHistogram() {
  const [selected, setSelected] = useState<number[]>([])
  return createElement(
    TooltipProvider,
    null,
    createElement(RequestsHistogram, { buckets, selected, onSelect: setSelected }),
  )
}

afterEach(cleanup)

it('supports individual and shift range selection with keyboard activation', () => {
  const view = render(createElement(TestHistogram))
  const bars = view.getAllByRole('button')
  fireEvent.click(bars[1], { detail: 0 })
  expect(bars.map((bar) => bar.getAttribute('aria-pressed'))).toEqual(['false', 'true', 'false', 'false'])
  fireEvent.click(bars[3], { detail: 0, shiftKey: true })
  expect(bars.map((bar) => bar.getAttribute('aria-pressed'))).toEqual(['false', 'true', 'true', 'true'])
  fireEvent.click(bars[1], { detail: 0, ctrlKey: true })
  expect(bars.map((bar) => bar.getAttribute('aria-pressed'))).toEqual(['false', 'false', 'true', 'true'])
  fireEvent.click(bars[0], { detail: 0, metaKey: true })
  expect(bars.map((bar) => bar.getAttribute('aria-pressed'))).toEqual(['true', 'false', 'true', 'true'])
})

it('clears the selected minutes on Escape, without consuming Escape in a text field', () => {
  const view = render(createElement(TestHistogram))
  const bars = view.getAllByRole('button')
  fireEvent.click(bars[0], { detail: 0 })
  expect(bars[0].querySelector('.histogram-bar-inner')?.className).toContain('outline-1')
  expect(bars[1].querySelector('.histogram-bar-inner')?.className).not.toContain('opacity-40')
  const input = document.createElement('input')
  document.body.appendChild(input)
  fireEvent.keyDown(input, { key: 'Escape' })
  expect(bars[0].getAttribute('aria-pressed')).toBe('true')
  input.remove()
  fireEvent.keyDown(bars[0], { key: 'Escape' })
  expect(bars[0].getAttribute('aria-pressed')).toBe('false')
  expect(bars[1].querySelector('.histogram-bar-inner')?.className).not.toContain('opacity-40')
})

it('selects a contiguous range by dragging across bars', () => {
  vi.stubGlobal('PointerEvent', MouseEvent)
  const view = render(createElement(TestHistogram))
  const bars = view.getAllByRole('button')
  const group = view.container.querySelector<HTMLElement>('[data-request-histogram]')!
  group.setPointerCapture = vi.fn()
  group.hasPointerCapture = () => false
  bars.forEach((bar, i) => {
    bar.getBoundingClientRect = () => ({ right: (i + 1) * 20 }) as DOMRect
  })
  fireEvent.pointerDown(bars[0], { button: 0, clientX: 10 })
  fireEvent.pointerMove(group, { clientX: 65 })
  fireEvent.pointerUp(group, { clientX: 65 })
  expect(bars.map((bar) => bar.getAttribute('aria-pressed'))).toEqual(['true', 'true', 'true', 'true'])
  fireEvent.pointerDown(bars[1], { button: 0, clientX: 30, ctrlKey: true })
  fireEvent.pointerUp(group, { clientX: 30, ctrlKey: true })
  expect(bars.map((bar) => bar.getAttribute('aria-pressed'))).toEqual(['true', 'false', 'true', 'true'])
  fireEvent.pointerDown(bars[3], { button: 0, clientX: 70, shiftKey: true })
  expect(bars.map((bar) => bar.getAttribute('aria-pressed'))).toEqual(['false', 'true', 'true', 'true'])
  vi.unstubAllGlobals()
})
