// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, expect, it } from 'vitest'
import { TooltipProvider } from '../../components/Tooltip'
import { UsageDailyChart } from './UsageDailyChart'

afterEach(cleanup)

it('anchors tooltips to the visible bar while retaining full-height hover targets', () => {
  const daily = [
    { day: '2026-10-25', requests: 2, promptTokens: 20, completionTokens: 10 },
    { day: '2026-10-26', requests: 1, promptTokens: 0, completionTokens: 100 },
    { day: '2026-10-27', requests: 0, promptTokens: 0, completionTokens: 0 },
  ]
  const view = render(createElement(TooltipProvider, null, createElement(UsageDailyChart, { daily, mode: 'all' })))
  const bars = view.getAllByRole('img')
  expect(bars).toHaveLength(3)
  for (const bar of bars) {
    expect(bar.parentElement?.className).toContain('h-full')
    expect(bar.className).not.toContain('h-full')
    expect(bar.className).toContain('before:h-(--usage-chart-height)')
  }
  expect(bars[0].children).toHaveLength(2)
  expect(bars[2].firstElementChild?.className).toContain('h-px')
})
