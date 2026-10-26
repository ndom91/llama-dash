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

it('bounds the markup of a single huge event, not just streams with many events', () => {
  const body = `data: ${JSON.stringify({ choices: [{ delta: { content: 'x'.repeat(2_800_000) } }] })}\n\n`
  const html = renderToStaticMarkup(createElement(RequestSseEvents, { body }))
  expect(html).toContain('data-virtualized="true"')
  expect(html.length).toBeLessThan(64_000)
})

it('formats a truncated Responses API event and displays the capture notice', () => {
  const body =
    'event: response.created\ndata: {"type":"response.created","response":{"model":"gpt","instructions":"partial text\n...[truncated 123 bytes]'
  const html = renderToStaticMarkup(createElement(RequestSseEvents, { body }))
  expect(html).toContain('response.created')
  expect(html).toContain('partial text')
  expect(html).toContain('[truncated 123 bytes]')
  expect(html).toContain('data-text-row')
  expect(html).not.toContain('&quot;type&quot;:&quot;response.created&quot;')
})

it('keeps a truncation notice after complete SSE events', () => {
  const html = renderToStaticMarkup(
    createElement(RequestSseEvents, {
      body: 'data: {"ok":true}\n\n\n...[truncated 42 bytes]',
    }),
  )
  expect(html).toContain('[truncated 42 bytes]')
  expect(html).toContain('sse-event')
})

it.each([
  { kind: 'malformed event', body: `data: not-json ${'x'.repeat(2_800_000)}\n\n` },
  { kind: 'unparsed stream', body: `unparsed capture ${'x'.repeat(2_800_000)}` },
])('also bounds $kind text', ({ body }) => {
  const html = renderToStaticMarkup(createElement(RequestSseEvents, { body }))
  expect(html).toContain('data-virtualized="true"')
  expect(html.length).toBeLessThan(64_000)
})
