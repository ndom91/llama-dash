// @vitest-environment jsdom
import { cleanup, renderHook } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { useRequestPayloadAnalysis } from './use-request-payload-analysis'

afterEach(cleanup)

it('shows persisted phase durations before payloads load, including zero', () => {
  const { result } = renderHook(() => useRequestPayloadAnalysis(undefined, false, null, 0, 1847.728))
  expect(result.current.timing).toEqual({ prefillMs: 0, decodeMs: 1847.728, streamCloseMs: null })
})

it('uses captured legacy JSON and SSE when no persisted values are available', () => {
  const body = {
    requestHeaders: null,
    requestBody: null,
    responseHeaders: null,
    responseBody: '{"timings":{"prompt_ms":12.5,"predicted_ms":40}}',
  }
  const json = renderHook(() => useRequestPayloadAnalysis(body, false, null))
  expect(json.result.current.timing).toEqual({ prefillMs: 12.5, decodeMs: 40, streamCloseMs: null })
  const stream = renderHook(() =>
    useRequestPayloadAnalysis({ ...body, responseBody: `data: ${body.responseBody}\n\n` }, true, 3),
  )
  expect(stream.result.current.timing).toEqual({ prefillMs: 12.5, decodeMs: 40, streamCloseMs: 3 })
})

it('prefers persisted measurements to possibly truncated captured stream timings', () => {
  const body = {
    requestHeaders: null,
    requestBody: null,
    responseHeaders: null,
    responseBody: 'data: {"timings":{"prompt_ms":5,"predicted_ms":10}}\n\n',
  }
  const { result } = renderHook(() => useRequestPayloadAnalysis(body, true, null, 5, 100))
  expect(result.current.timing.decodeMs).toBe(100)
})
