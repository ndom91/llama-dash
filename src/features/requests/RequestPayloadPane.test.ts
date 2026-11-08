// @vitest-environment jsdom
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { RequestPayloadPane } from './RequestPayloadPane'
import { RequestSseEvents } from './RequestSseEvents'
import { RequestTextView } from './RequestTextView'

const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard')
afterEach(() => {
  cleanup()
  localStorage.clear()
  if (originalClipboard) Object.defineProperty(navigator, 'clipboard', originalClipboard)
  else Reflect.deleteProperty(navigator, 'clipboard')
})

it.each([
  'pretty',
  'raw',
] as const)('copies the full original %s body rather than just the mounted chunks', async (mode) => {
  const body = JSON.stringify({ content: `${'x'.repeat(2_800_000)}TAIL_SENTINEL` })
  const writeText = vi.fn(async () => {})
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
  const view = render(
    createElement(RequestPayloadPane, { title: 'Response', subtitle: 'JSON', body, headers: null, mode }),
  )
  expect(view.container.querySelector('[data-virtualized="true"]')).not.toBeNull()
  await act(async () => {
    fireEvent.click(view.getByRole('button', { name: 'Copy Response payload' }))
  })
  expect(writeText).toHaveBeenCalledWith(body)
})

it('does not mount hidden assembled text and uses bounded chunks when opened', () => {
  const body = `data: ${JSON.stringify({ choices: [{ delta: { content: 'x'.repeat(2_800_000) } }] })}\n\n`
  const view = render(createElement(RequestSseEvents, { body }))
  const panel = view.container.querySelector('#request-sse-assembled')!
  expect(panel.querySelector('[data-text-view]')).toBeNull()
  fireEvent.click(view.getByRole('button', { name: /^assembled text/i }))
  expect(panel.querySelector('[data-virtualized="true"]')).not.toBeNull()
  fireEvent.click(view.getByRole('button', { name: /^assembled text/i }))
  expect(panel.querySelector('[data-text-view]')).toBeNull()
})

it('replaces virtualized content cleanly when the body changes to a short value', () => {
  const view = render(createElement(RequestTextView, { text: 'x'.repeat(100_000) }))
  expect(view.getByRole('region', { name: 'Scrollable payload text' }).tabIndex).toBe(0)
  view.rerender(createElement(RequestTextView, { text: 'replacement body' }))
  expect(view.container.textContent).toBe('replacement body')
  expect(view.container.querySelector('[data-virtualized="false"]')).not.toBeNull()
  expect(view.queryByRole('region')).toBeNull()
})

it('keeps the nested browser headers disclosure independent of the mobile headers disclosure', () => {
  const view = render(
    createElement(RequestPayloadPane, {
      title: 'Request',
      subtitle: 'JSON',
      body: '{}',
      headers: { 'content-type': 'application/json', 'sec-fetch-site': 'same-origin' },
      mode: 'pretty',
    }),
  )
  const headers = view.getByRole('button', { name: /^Headers/ })
  const browserHeaders = view.getByRole('button', { name: /show 1 browser header/i })
  fireEvent.click(headers)
  expect(headers.getAttribute('aria-expanded')).toBe('true')
  expect(browserHeaders.getAttribute('aria-expanded')).toBe('false')
  fireEvent.click(browserHeaders)
  expect(browserHeaders.getAttribute('aria-expanded')).toBe('true')
  fireEvent.click(headers)
  expect(headers.getAttribute('aria-expanded')).toBe('false')
})
