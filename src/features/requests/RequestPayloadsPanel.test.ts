// @vitest-environment jsdom
import { cleanup, fireEvent, render } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { RequestPayloadsPanel } from './RequestPayloadsPanel'
import type { RequestPayloadState } from './requestPayloadState'
import { useRequestPayloadAnalysis } from './use-request-payload-analysis'

function Panel({ state, onRetry = () => {} }: { state: RequestPayloadState; onRetry?: () => void }) {
  const data = state.status === 'loading' ? undefined : state.data
  const analysis = useRequestPayloadAnalysis(data, false, null)
  return createElement(RequestPayloadsPanel, {
    request: { id: 'req_fixture', streamed: false, promptTokens: 2, completionTokens: 3 },
    state,
    analysis,
    onRetry,
  })
}

afterEach(cleanup)

it('shows skeletons for loading rather than claiming bodies were not captured', () => {
  const view = render(createElement(Panel, { state: { status: 'loading' } }))
  expect(view.container.querySelectorAll('.skel-body-lines')).toHaveLength(2)
  expect(view.queryByText('No body payload')).toBeNull()
  expect(view.getByRole('status').textContent).toBe('loading payloads…')
})

it('renders captured-empty bodies only after successful loading', () => {
  const view = render(
    createElement(Panel, {
      state: {
        status: 'ready',
        data: {
          requestBody: null,
          responseBody: null,
          requestHeaders: null,
          responseHeaders: null,
        },
      },
    }),
  )
  expect(view.getAllByText('No body payload')).toHaveLength(2)
  expect(view.container.querySelector('.skel-body-lines')).toBeNull()
})

it('owns failure presentation and retries without presenting stale cached bodies', () => {
  const retry = vi.fn()
  const view = render(
    createElement(Panel, {
      state: {
        status: 'error',
        message: 'Unavailable',
        data: {
          requestBody: 'cached secret',
          responseBody: null,
          requestHeaders: null,
          responseHeaders: null,
        },
      },
      onRetry: retry,
    }),
  )
  expect(view.getByRole('alert').textContent).toContain('Unavailable')
  expect(view.queryByText('cached secret')).toBeNull()
  expect(view.container.querySelector('.skel-body-lines')).toBeNull()
  fireEvent.click(view.getByRole('button', { name: 'Retry payloads' }))
  expect(retry).toHaveBeenCalledOnce()
})
