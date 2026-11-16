// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { TooltipProvider } from '../../components/Tooltip'
import { RequestsPaginationCard } from './RequestsPaginationCard'

beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  )
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

it('stops loading and explains when the last page is exhausted', async () => {
  const onLoadMore = vi.fn()
  const props = {
    hasLocalFilters: true,
    hasNextPage: true,
    isFetching: false,
    isFetchingNextPage: false,
    isFetchNextPageError: false,
    onLoadMore,
  }
  const view = render(
    <TooltipProvider>
      <RequestsPaginationCard {...props} />
    </TooltipProvider>,
  )
  fireEvent.click(screen.getByRole('button', { name: 'Load older requests' }))
  expect(onLoadMore).toHaveBeenCalledTimes(1)

  view.rerender(
    <TooltipProvider>
      <RequestsPaginationCard {...props} hasNextPage={false} />
    </TooltipProvider>,
  )
  const button = screen.getByRole('button', { name: 'Load older requests' })
  expect(button.getAttribute('aria-disabled')).toBe('true')
  fireEvent.click(button)
  expect(onLoadMore).toHaveBeenCalledTimes(1)
  expect(screen.getByRole('status').textContent).toContain('No more older requests')
  fireEvent.focus(button)
  expect((await screen.findByRole('tooltip')).textContent).toContain('No more older requests available to load')
})
