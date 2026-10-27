// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { TooltipProvider } from '../../components/Tooltip'
import { UsagePage } from './UsagePage'

const reportState = vi.hoisted(() => ({ data: undefined as unknown, error: null as Error | null }))

vi.mock('@tanstack/react-router', () => ({
  getRouteApi: () => ({ useSearch: () => ({ days: 7 }) }),
  useNavigate: () => vi.fn(),
  Link: ({ children }: { children: unknown }) => children,
}))
vi.mock('../../lib/queries', () => ({ useUsageReport: () => reportState }))
vi.mock('../../lib/use-sticky-toggle', () => ({ useStickyToggle: () => [false, vi.fn()] }))

afterEach(() => {
  cleanup()
  reportState.data = undefined
  reportState.error = null
})

it('keeps the header outside the scroll region with one divider for loaded and empty states', () => {
  const totals = { requests: 0, errors: 0, promptTokens: 0, completionTokens: 0, totalTokens: 0, costUsd: null }
  reportState.data = {
    days: 7,
    from: '2026-10-21',
    to: '2026-10-27',
    oldestDay: '2026-10-21',
    totals,
    previous: totals,
    daily: [],
    retentionDays: 30,
    panels: [],
  }
  const view = render(createElement(TooltipProvider, null, createElement(UsagePage)))
  const header = view.getByRole('heading', { name: 'Usage' }).closest('.page-header')
  const scrollRegion = header?.nextElementSibling
  expect(header).not.toBeNull()
  expect(scrollRegion?.className).toContain('overflow-y-auto')
  expect(scrollRegion?.firstElementChild?.className).not.toContain('border-t')
  expect(header?.parentElement?.className).toContain('min-h-0')

  reportState.data = { ...(reportState.data as object), oldestDay: null }
  view.rerender(createElement(TooltipProvider, null, createElement(UsagePage)))
  expect(view.getByText(/No usage recorded yet/).className).not.toContain('border-t')
})
