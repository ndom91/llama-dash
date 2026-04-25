import { describe, expect, it } from 'vitest'
import {
  applyProxyBodyHeaders,
  applyProxyBodyTransform,
  getProxyForwardBody,
  getProxyLoggedBody,
  MAX_PROXY_BODY_BYTES,
  prepareProxyBody,
} from './body'

describe('prepareProxyBody', () => {
  it('extracts routing fields from JSON request bodies', async () => {
    const request = new Request('http://dash.test/v1/messages', {
      method: 'POST',
      body: JSON.stringify({ model: 'claude-opus-4-6', stream: true, messages: [] }),
    })

    const body = await prepareProxyBody(request, 'POST')

    expect(body.isMultipart).toBe(false)
    expect(body.bodyText).toContain('claude-opus-4-6')
    expect(body.parsedBody).toMatchObject({ model: 'claude-opus-4-6', stream: true })
    expect(body.reqModel).toBe('claude-opus-4-6')
    expect(getProxyLoggedBody(body)).toBe(body.bodyText)
  })

  it('extracts model and stream hints from malformed JSON prefixes', async () => {
    const request = new Request('http://dash.test/v1/messages', {
      method: 'POST',
      body: '{"model":"claude-opus-4-6","stream":true,',
    })

    const body = await prepareProxyBody(request, 'POST')

    expect(body.parsedBody).toEqual({ model: 'claude-opus-4-6', stream: true })
  })

  it('extracts routing fields from multipart form data', async () => {
    const form = new FormData()
    form.set('model', 'whisper-large')
    form.set('stream', 'false')
    const request = new Request('http://dash.test/v1/audio/transcriptions', { method: 'POST', body: form })

    const body = await prepareProxyBody(request, 'POST')

    expect(body.isMultipart).toBe(true)
    expect(body.multipartFormData?.get('model')).toBe('whisper-large')
    expect(body.parsedBody).toEqual({ model: 'whisper-large', stream: false })
    expect(body.reqModel).toBe('whisper-large')
    expect(getProxyLoggedBody(body)).toBeNull()
  })

  it('serializes transformed JSON bodies and updates content length', async () => {
    const request = new Request('http://dash.test/v1/messages', {
      method: 'POST',
      body: JSON.stringify({ model: 'before', messages: [] }),
    })
    const body = await prepareProxyBody(request, 'POST')
    const transformed = applyProxyBodyTransform(body, {
      mutated: true,
      body: { model: 'after', messages: [] },
    })
    const headers: Record<string, string> = {}

    applyProxyBodyHeaders(transformed, headers)

    expect(transformed.reqModel).toBe('after')
    expect(getProxyForwardBody(transformed, request)).toBe('{"model":"after","messages":[]}')
    expect(headers['content-length']).toBe(String(Buffer.byteLength(transformed.bodyText ?? '', 'utf8')))
  })

  it('updates multipart model fields without logging the body', async () => {
    const form = new FormData()
    form.set('model', 'before')
    const request = new Request('http://dash.test/v1/audio/transcriptions', { method: 'POST', body: form })
    const body = await prepareProxyBody(request, 'POST')

    const transformed = applyProxyBodyTransform(body, {
      mutated: true,
      body: { model: 'after' },
    })

    expect(transformed.reqModel).toBe('after')
    expect(transformed.multipartFormData?.get('model')).toBe('after')
    expect(getProxyLoggedBody(transformed)).toBeNull()
  })

  it('rejects bodies over the hard proxy body limit', async () => {
    const request = new Request('http://dash.test/v1/messages', {
      method: 'POST',
      headers: { 'content-length': String(MAX_PROXY_BODY_BYTES + 1) },
      body: '{}',
    })

    await expect(prepareProxyBody(request, 'POST')).rejects.toThrow('Request body exceeds')
  })
})
