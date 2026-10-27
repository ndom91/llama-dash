// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { TooltipProvider } from '../../components/Tooltip'
import { UsagePage } from './UsagePage'
import { UsagePagePending } from './UsagePagePending'

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
  const cards = header?.nextElementSibling
  const scrollRegion = cards?.nextElementSibling
  expect(header).not.toBeNull()
  expect(cards?.className).toContain('dashboard-stats-row')
  expect(scrollRegion?.className).toContain('overflow-y-auto')
  expect(scrollRegion?.firstElementChild?.className).not.toContain('border-t')
  expect(header?.parentElement?.className).toContain('min-h-0')

  reportState.data = { ...(reportState.data as object), oldestDay: null }
  view.rerender(createElement(TooltipProvider, null, createElement(UsagePage)))
  expect(view.getByText(/No usage recorded yet/).className).not.toContain('border-t')
})

it('shows a usage-shaped skeleton during navigation and initial data loading', () => {
  const pending = render(createElement(UsagePagePending))
  expect(pending.getByRole('status', { name: 'Loading usage' })).toBeDefined()
  expect(pending.container.querySelectorAll('.stat-card')).toHaveLength(4)
  expect(pending.container.querySelectorAll('.skel-block')).toHaveLength(7)
  expect(pending.container.querySelector('.dashboard-stats-row')?.closest('.overflow-y-auto')).toBeNull()
  pending.unmount()

  const loading = render(createElement(TooltipProvider, null, createElement(UsagePage)))
  expect(loading.getByRole('heading', { name: 'Usage' })).toBeDefined()
  expect(loading.getByRole('status', { name: 'Loading usage' })).toBeDefined()
  expect(loading.container.querySelector('.dashboard-stats-row')?.closest('.overflow-y-auto')).toBeNull()
  expect(loading.queryByText('loading…')).toBeNull()

  reportState.error = new Error('Usage unavailable')
  loading.rerender(createElement(TooltipProvider, null, createElement(UsagePage)))
  expect(loading.getByText('Usage unavailable')).toBeDefined()
  expect(loading.queryByRole('status', { name: 'Loading usage' })).toBeNull()
})

it('uses input and output labels without changing token values', () => {
  const totals = { requests: 1, errors: 0, promptTokens: 20, completionTokens: 10, totalTokens: 30, costUsd: null }
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
  expect(view.getByRole('button', { name: 'output' })).toBeDefined()
  expect(view.getAllByText('output').length).toBeGreaterThan(0)
  expect(view.getAllByText('input').length).toBeGreaterThan(0)
  expect(view.getByText('10')).toBeDefined()
  expect(view.getByText('20')).toBeDefined()
})
