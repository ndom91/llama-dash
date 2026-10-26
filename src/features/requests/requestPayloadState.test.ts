import { expect, it } from 'vitest'
import { requestPayloadState } from './requestPayloadState'
import type { RequestPayloads } from '../../lib/schemas/request'

const empty: RequestPayloads = { requestBody: null, responseBody: null, requestHeaders: null, responseHeaders: null }

it('distinguishes pending payloads from successfully loaded uncaptured bodies', () => {
  expect(requestPayloadState(undefined, null, false)).toEqual({ status: 'loading' })
  expect(requestPayloadState(empty, null, false)).toEqual({ status: 'ready', data: empty })
})

it('keeps metadata placeholders from enabling complete-detail actions early', () => {
  expect(requestPayloadState(empty, null, true)).toEqual({ status: 'loading' })
})

it('reports failures explicitly and retains already loaded payloads during a failed refresh', () => {
  const error = new Error('Unavailable')
  expect(requestPayloadState(undefined, error, false)).toEqual({
    status: 'error',
    message: 'Unavailable',
    data: undefined,
  })
  expect(requestPayloadState(empty, error, false)).toEqual({ status: 'error', message: 'Unavailable', data: empty })
})
