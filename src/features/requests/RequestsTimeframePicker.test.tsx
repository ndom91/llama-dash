// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { TooltipProvider } from '../../components/Tooltip'
import { RequestsTimeframePicker } from './RequestsTimeframePicker'

const now = new Date(2026, 10, 16, 20, 20).getTime()
beforeEach(() => vi.spyOn(Date, 'now').mockReturnValue(now))
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

async function open(earliestRetainedAt?: number | null) {
  const onChange = vi.fn()
  render(
    <TooltipProvider>
      <RequestsTimeframePicker
        value={{ timeframe: '3h' }}
        onChange={onChange}
        earliestRetainedAt={earliestRetainedAt}
      />
    </TooltipProvider>,
  )
  fireEvent.click(screen.getByRole('button', { name: 'Timeframe: Last 3 hours' }))
  await screen.findByRole('grid')
  return onChange
}
const day = (n: number) =>
  within(screen.getByRole('grid')).getByRole('button', { name: new RegExp(`November ${n}(?:st|nd|rd|th), 2026`) })

it('shows a single calendar and read-only previews, and commits a preset immediately', async () => {
  const onChange = await open()
  expect(screen.getAllByRole('grid')).toHaveLength(1)
  expect(screen.getByLabelText('From date')).toHaveProperty('readOnly', true)
  expect(screen.getByLabelText('From time')).toHaveProperty('value', '17:20')
  expect(screen.getByLabelText('To date')).toHaveProperty('value', 'now')
  expect(screen.queryByRole('button', { name: 'Apply' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Last 30 days' }))
  expect(onChange).toHaveBeenCalledExactlyOnceWith({ timeframe: '30d', from: undefined, to: undefined })
  await waitFor(() => expect(screen.queryByRole('grid')).toBeNull())
})

it('previews a draft range, focuses its end time, and applies only on confirmation', async () => {
  const onChange = await open()
  fireEvent.click(day(12))
  expect(day(12).closest('td')?.classList.contains('request-range-endpoint')).toBe(true)
  expect(day(16).closest('td')?.classList.contains('request-range-endpoint')).toBe(false)
  expect(screen.getByLabelText('From date')).toHaveProperty('value', 'Nov 12, 2026')
  expect(screen.getByLabelText('To date')).toHaveProperty('value', '')
  expect(screen.getByRole('button', { name: 'Apply' })).toHaveProperty('disabled', true)
  fireEvent.mouseEnter(day(15))
  expect(day(13).closest('td')?.classList.contains('request-range-preview')).toBe(true)
  fireEvent.click(day(16))
  expect(day(12).closest('td')?.classList.contains('request-range-endpoint')).toBe(true)
  expect(day(16).closest('td')?.classList.contains('request-range-endpoint')).toBe(true)
  expect(day(13).closest('td')?.getAttribute('aria-selected')).toBe('true')
  expect(document.activeElement).toBe(screen.getByLabelText('To time'))
  expect(onChange).not.toHaveBeenCalled()
  fireEvent.change(screen.getByLabelText('To time'), { target: { value: '19:30' } })
  fireEvent.click(screen.getByRole('button', { name: 'Apply' }))
  expect(onChange).toHaveBeenCalledExactlyOnceWith({
    timeframe: 'custom',
    from: new Date(2026, 10, 12).getTime(),
    to: new Date(2026, 10, 16, 19, 30).getTime(),
  })
})

it('restarts on an endpoint and discards edits when cancelled or escaped', async () => {
  const onChange = await open()
  fireEvent.click(day(14))
  fireEvent.click(day(16))
  fireEvent.click(day(14))
  expect(screen.getByLabelText('To date')).toHaveProperty('value', '')
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
  await waitFor(() => expect(screen.queryByRole('grid')).toBeNull())
  fireEvent.click(screen.getByRole('button', { name: 'Timeframe: Last 3 hours' }))
  expect(await screen.findByLabelText('From time')).toHaveProperty('value', '17:20')
  fireEvent.click(day(13))
  fireEvent.keyDown(screen.getByLabelText('From date'), { key: 'Escape' })
  await waitFor(() => expect(screen.queryByRole('grid')).toBeNull())
  expect(onChange).not.toHaveBeenCalled()
})

it('disables future/expired days and blocks invalid or out-of-retention text edits', async () => {
  const onChange = await open(new Date(2026, 10, 12, 10).getTime())
  expect(day(11)).toHaveProperty('disabled', true)
  expect(day(17)).toHaveProperty('disabled', true)
  fireEvent.click(day(14))
  fireEvent.click(day(16))
  fireEvent.change(screen.getByLabelText('From date'), { target: { value: 'Nov 11, 2026' } })
  expect(screen.getByRole('alert').textContent).toContain('retained history')
  expect(screen.getByRole('button', { name: 'Apply' })).toHaveProperty('disabled', true)
  fireEvent.change(screen.getByLabelText('From date'), { target: { value: 'Nov 14, 2026' } })
  fireEvent.change(screen.getByLabelText('To time'), { target: { value: '25:00' } })
  expect(screen.getByRole('button', { name: 'Apply' })).toHaveProperty('disabled', true)
  fireEvent.submit(screen.getByRole('form'))
  expect(onChange).not.toHaveBeenCalled()
})

it('supports arrow navigation, shortcut typeahead, and Tab into the calendar', async () => {
  const onChange = await open()
  const selected = screen.getByRole('button', { name: 'Last 3 hours' })
  selected.focus()
  fireEvent.keyDown(selected, { key: 'ArrowDown' })
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Last 24 hours' }))
  fireEvent.keyDown(document.activeElement!, { key: '7' })
  fireEvent.keyDown(document.activeElement!, { key: 'd' })
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Last 7 days' }))
  expect(screen.getByText('↑↓ move · ↵ apply · tab calendar')).toBeTruthy()
  fireEvent.keyDown(document.activeElement!, { key: 'Tab' })
  expect(screen.getByRole('grid').contains(document.activeElement)).toBe(true)
  expect(onChange).not.toHaveBeenCalled()
})

it('keeps the empty-history calendar unavailable', async () => {
  await open(null)
  expect(day(16)).toHaveProperty('disabled', true)
  fireEvent.click(screen.getByRole('button', { name: 'Custom' }))
  expect(screen.getByRole('button', { name: 'Apply' })).toHaveProperty('disabled', true)
})

it('keeps a current-minute endpoint valid when the clock advances while the picker is open', async () => {
  await open()
  vi.mocked(Date.now).mockReturnValue(now + 60_000)
  fireEvent.click(day(14))
  fireEvent.click(day(16))
  expect(screen.getByLabelText('To time')).toHaveProperty('value', '20:21')
  expect(screen.getByRole('button', { name: 'Apply' })).toHaveProperty('disabled', false)
  expect(screen.queryByRole('alert')).toBeNull()
})
