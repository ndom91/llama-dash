// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { TooltipProvider } from '../../components/Tooltip'
import { RequestTokenTrace } from './RequestTokenTrace'

vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
)

afterEach(() => {
  cleanup()
})

it.each([
  {
    prefillMs: 500,
    decodeMs: 1000,
    firstOutputMs: null,
    outputSpanMs: null,
    labels: ['prefill 500ms', 'decode 1.00s'],
  },
  {
    prefillMs: null,
    decodeMs: null,
    firstOutputMs: 500,
    outputSpanMs: 1000,
    labels: ['first output 500ms · proxy observed', 'output span 1.00s · proxy observed'],
  },
])('shows matching tooltips for measured segments', async (timings) => {
  for (const [index, label] of timings.labels.entries()) {
    const view = render(
      createElement(
        TooltipProvider,
        null,
        createElement(RequestTokenTrace, {
          durationMs: 2000,
          completionTokens: 20,
          tokPerSec: 10,
          streamed: true,
          ...timings,
        }),
      ),
    )
    const bar = view.container.querySelector('[aria-hidden="true"].flex')
    expect(bar?.children).toHaveLength(2)
    fireEvent.pointerMove(bar?.children[index] as Element, { pointerType: 'mouse' })
    await waitFor(() => expect(screen.getByRole('tooltip').textContent).toContain(label))
    view.unmount()
  }
})
