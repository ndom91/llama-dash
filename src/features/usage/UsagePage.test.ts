// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { TooltipProvider } from '../../components/Tooltip'
import { UsagePage } from './UsagePage'
import { UsagePagePending } from './UsagePagePending'

const reportState = vi.hoisted(() => ({ data: undefined as unknown, error: null as Error | null, days: 7 }))

vi.mock('@tanstack/react-router', () => ({
  getRouteApi: () => ({ useSearch: () => ({ days: reportState.days }) }),
  useNavigate: () => vi.fn(),
  Link: ({ children }: { children: unknown }) => children,
}))
vi.mock('../../lib/queries', () => ({ useUsageReport: () => reportState }))
vi.mock('../../lib/use-sticky-toggle', () => ({ useStickyToggle: () => [false, vi.fn()] }))

afterEach(() => {
  cleanup()
  reportState.data = undefined
  reportState.error = null
  reportState.days = 7
})

it('shows the one-day period and a single UTC date', () => {
  const totals = { requests: 1, errors: 0, promptTokens: 20, completionTokens: 10, totalTokens: 30, costUsd: null }
  reportState.days = 1
  reportState.data = {
    days: 1,
    from: '2026-10-27',
    to: '2026-10-27',
    oldestDay: '2026-10-27',
    totals,
    previous: totals,
    daily: [{ day: '2026-10-27', requests: 1, promptTokens: 20, completionTokens: 10 }],
    retentionDays: 30,
    panels: [],
  }
  const view = render(createElement(TooltipProvider, null, createElement(UsagePage)))
  expect(view.getByRole('button', { name: '1d' }).getAttribute('aria-pressed')).toBe('true')
  expect(view.getByText(/Oct 27 · UTC day/)).toBeDefined()
  expect(view.getByText('today · UTC')).toBeDefined()
  expect(view.getByRole('img', { name: '2026-10-27: 30 tokens' }).parentElement?.className).toContain('max-w-24')
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
  expect(pending.container.querySelector('.dashboard-stats-row')?.getAttribute('aria-hidden')).toBe('true')
  const skeletonPanels = pending.getByRole('status', { name: 'Loading usage' }).querySelector('.grid')?.children
  expect(skeletonPanels?.[0].className).toContain('max-[1100px]:border-b')
  expect(skeletonPanels?.[2].className).toContain('border-t')
  pending.unmount()

  const loading = render(createElement(TooltipProvider, null, createElement(UsagePage)))
  expect(loading.getByRole('heading', { name: 'Usage' })).toBeDefined()
  expect(loading.getByRole('status', { name: 'Loading usage' })).toBeDefined()
  expect(loading.container.querySelector('.dashboard-stats-row')?.closest('.overflow-y-auto')).toBeNull()
  expect(loading.container.querySelector('.dashboard-stats-row')?.getAttribute('aria-hidden')).toBe('true')
  expect(loading.queryByText('loading…')).toBeNull()

  reportState.error = new Error('Usage unavailable')
  loading.rerender(createElement(TooltipProvider, null, createElement(UsagePage)))
  expect(loading.getByText('Usage unavailable')).toBeDefined()
  expect(loading.queryByRole('status', { name: 'Loading usage' })).toBeNull()
})

it('puts the full-width divider above the third configured breakdown', () => {
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
    panels: [
      { dimension: 'model', values: 0, rows: [], others: null, partial: true },
      { dimension: 'key', values: 0, rows: [], others: null, partial: false },
      { dimension: 'client', values: 0, rows: [], others: null, partial: false },
    ],
  }
  const view = render(createElement(TooltipProvider, null, createElement(UsagePage)))
  const first = view.getByText('By model').closest('section')?.parentElement
  const second = view.getByText('By key').closest('section')?.parentElement
  const third = view.getByText('By app').closest('section')?.parentElement
  expect(first?.className).toContain('max-[1100px]:[&>section]:!border-b')
  expect(second?.className).toContain('[&>section]:!border-b-0')
  expect(third?.className).toContain('col-span-2 border-t border-border')
  expect(third?.parentElement).toBe(first?.parentElement)
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
