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
      firstOutputMs: null,
      outputSpanMs: null,
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

it('labels proxy-observed output separately from upstream timings', () => {
  const html = renderToStaticMarkup(
    createElement(RequestTokenTrace, {
      durationMs: 2000,
      completionTokens: 20,
      tokPerSec: 10,
      prefillMs: null,
      decodeMs: null,
      streamed: true,
      firstOutputMs: 500,
      outputSpanMs: 1000,
    }),
  )
  expect(html).toContain('first output')
  expect(html).toContain('output span')
  expect(html).toContain('proxy observed')
  expect(html).toContain('tok/s overall')
  expect(html).not.toContain('no upstream phase timings')
})
