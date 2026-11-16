// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { DateTimePicker } from './DateTimePicker'
import { RequestsTimeframePicker } from '../features/requests/RequestsTimeframePicker'

afterEach(cleanup)

function Example() {
  const [value, setValue] = useState('2026-11-16T17:05')
  return <DateTimePicker label="Start" value={value} onChange={setValue} />
}

it('preserves the clock when picking a date and the date when editing the clock', async () => {
  render(<Example />)
  fireEvent.click(screen.getByRole('button', { name: /Start:/ }))
  const grid = await screen.findByRole('grid')
  fireEvent.click(within(grid).getByRole('button', { name: /November 17th, 2026/ }))
  expect(screen.getByRole('button', { name: /Start:.*17.*17:05/ })).toBeTruthy()
  const hours = screen.getByRole('textbox', { name: 'Hours' })
  fireEvent.change(hours, { target: { value: '09' } })
  fireEvent.blur(hours)
  expect(screen.getByRole('button', { name: /Start:.*17.*09:05/ })).toBeTruthy()
  const minutes = screen.getByRole('textbox', { name: 'Minutes' })
  fireEvent.change(minutes, { target: { value: '42' } })
  fireEvent.blur(minutes)
  expect(screen.getByRole('button', { name: /Start:.*17.*09:42/ })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Done' }))
  await waitFor(() => expect(screen.queryByRole('grid')).toBeNull())
})

it('keeps nested calendar edits as a draft and rejects an invalid range before applying', async () => {
  const onChange = vi.fn()
  render(
    <RequestsTimeframePicker
      value={{
        timeframe: 'custom',
        from: new Date(2026, 10, 16, 10).getTime(),
        to: new Date(2026, 10, 16, 11).getTime(),
      }}
      onChange={onChange}
    />,
  )
  fireEvent.click(screen.getByRole('button', { name: 'Timeframe: Custom range' }))
  fireEvent.click(await screen.findByRole('button', { name: /Start:/ }))
  const hours = await screen.findByRole('textbox', { name: 'Hours' })
  fireEvent.change(hours, { target: { value: '12' } })
  fireEvent.blur(hours)
  fireEvent.click(screen.getByRole('button', { name: 'Done' }))
  expect(onChange).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Apply range' }))
  expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'End must be later than start.')
  expect(onChange).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: /Start:/ }))
  const corrected = await screen.findByRole('textbox', { name: 'Hours' })
  fireEvent.change(corrected, { target: { value: '09' } })
  fireEvent.blur(corrected)
  fireEvent.click(screen.getByRole('button', { name: 'Done' }))
  fireEvent.click(screen.getByRole('button', { name: 'Apply range' }))
  expect(onChange).toHaveBeenCalledWith({
    timeframe: 'custom',
    from: new Date(2026, 10, 16, 9).getTime(),
    to: new Date(2026, 10, 16, 11).getTime(),
  })
})
