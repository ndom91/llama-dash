import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { RequestTokenTrace } from './RequestTokenTrace'

it('labels non-streaming measurements as timing, not stream or eos', () => {
  const html = renderToStaticMarkup(
    createElement(RequestTokenTrace, {
      durationMs: 5000,
      completionTokens: null,
      tokPerSec: null,
      prefillMs: 100,
      decodeMs: 200,
      streamed: false,
    }),
  )
  expect(html).toContain('phase breakdown')
  expect(html).toContain('prefill')
  expect(html).toContain('decode')
  expect(html).toContain('total')
  expect(html).not.toContain('token trace')
  expect(html).not.toContain('eos')
})
