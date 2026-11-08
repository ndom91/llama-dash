import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { UsageDelta } from './UsageDelta'

describe('UsageDelta', () => {
  it.each([
    { current: 150, previous: 100, color: 'text-ok', direction: 'up' },
    { current: 50, previous: 100, color: 'text-err', direction: 'down' },
  ])('colors $direction changes without relying on color alone', ({ current, previous, color, direction }) => {
    const html = renderToStaticMarkup(<UsageDelta current={current} previous={previous} against="vs prev" />)
    expect(html).toContain(color)
    expect(html).toContain(`aria-label="${direction}"`)
    expect(html).toContain('50%')
  })

  it.each([
    [100, 100],
    [0, 0],
    [1, 0],
  ])('keeps flat or unavailable comparisons neutral', (current, previous) => {
    const html = renderToStaticMarkup(<UsageDelta current={current} previous={previous} against="vs prev" />)
    expect(html).not.toContain('text-ok')
    expect(html).not.toContain('text-err')
  })
})
