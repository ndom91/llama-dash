import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { RequestSseEvents } from './RequestSseEvents'

function markup(count: number) {
  const body = Array.from({ length: count }, (_, i) => `data: {"index":${i}}\n\n`).join('')
  return renderToStaticMarkup(createElement(RequestSseEvents, { body }))
}

it('renders all events for short streams', () => {
  expect(markup(5).match(/class="sse-event"/g)).toHaveLength(5)
})

it('bounds the rendered event count for large streams', () => {
  const html = markup(5000)
  const rendered = html.match(/class="sse-event"/g)?.length ?? 0
  expect(rendered).toBeGreaterThan(0)
  expect(rendered).toBeLessThan(30)
  expect(html).toContain('aria-setsize="5000"')
})

it('retains raw content when there are no parsed SSE events', () => {
  expect(renderToStaticMarkup(createElement(RequestSseEvents, { body: 'raw capture' }))).toBe('raw capture')
})
