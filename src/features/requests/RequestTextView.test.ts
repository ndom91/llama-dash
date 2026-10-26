import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { RequestTextView } from './RequestTextView'

it('preserves highlighting for ordinary JSON', () => {
  const html = renderToStaticMarkup(
    createElement(RequestTextView, {
      text: '{\n  "name": "llama",\n  "count": 2\n}',
      highlightJson: true,
    }),
  )
  expect(html).toContain('jh-key')
  expect(html).toContain('jh-str')
  expect(html).toContain('jh-num')
  expect(html).toContain('data-virtualized="false"')
})

it('virtualizes a huge value with few logical lines without mounting the entire string', () => {
  const text = JSON.stringify({ content: `${'x'.repeat(2_800_000)}TAIL_SENTINEL` }, null, 2)
  const html = renderToStaticMarkup(createElement(RequestTextView, { text, highlightJson: true }))
  expect(html).toContain('data-virtualized="true"')
  const mounted = html.match(/data-text-row="true"/g)?.length ?? 0
  expect(mounted).toBeGreaterThan(0)
  expect(mounted).toBeLessThan(40)
  expect(html.length).toBeLessThan(64_000)
  expect(html).not.toContain('TAIL_SENTINEL')
})

it('also virtualizes raw text and ordinary large line counts', () => {
  for (const text of ['plain '.repeat(500_000), 'short line\n'.repeat(1000), `${'x'.repeat(200)}\n`.repeat(250)]) {
    const html = renderToStaticMarkup(createElement(RequestTextView, { text }))
    expect(html).toContain('data-virtualized="true"')
    expect(html.length).toBeLessThan(64_000)
    expect(html).not.toContain('jh-str')
  }
})

it('bounds the height of a large embedded SSE event without padding short events to that height', () => {
  const large = renderToStaticMarkup(createElement(RequestTextView, { text: 'x'.repeat(100_000), embedded: true }))
  const short = renderToStaticMarkup(createElement(RequestTextView, { text: 'small', embedded: true }))
  expect(large).toContain('h-80')
  expect(short).not.toContain('h-80')
})
