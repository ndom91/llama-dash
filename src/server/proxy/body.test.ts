import { describe, expect, it } from 'vitest'
import {
  applyProxyBodyHeaders,
  applyProxyBodyTransform,
  getProxyForwardBody,
  getProxyLoggedBody,
  MAX_PROXY_BODY_BYTES,
  prepareProxyBody,
  restoreProxyBodyContentLength,
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

  it('streams multipart form data without parsing it', async () => {
    const form = new FormData()
    form.set('model', 'whisper-large')
    form.set('stream', 'false')
    const request = new Request('http://dash.test/v1/audio/transcriptions', { method: 'POST', body: form })

    const body = await prepareProxyBody(request, 'POST')

    expect(body.isMultipart).toBe(true)
    expect(body.preserveContentLength).toBe(true)
    expect(body.parsedBody).toBeNull()
    expect(body.reqModel).toBeNull()
    expect(getProxyForwardBody(body, request)).toBe(request.body)
    expect(getProxyLoggedBody(body)).toBeNull()
  })

  it('streams multipart bodies unchanged without reading malformed forms', async () => {
    const bodyStream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('--dash\r\nmalformed'))
        controller.close()
      },
    })
    const request = new Request('http://dash.test/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'content-type': 'multipart/form-data; boundary=dash' },
      body: bodyStream,
      ...({ duplex: 'half' } as RequestInit),
    })

    const body = await prepareProxyBody(request, 'POST')

    expect(body.isMultipart).toBe(true)
    expect(body.preserveContentLength).toBe(true)
    expect(body.parsedBody).toBeNull()
    expect(getProxyForwardBody(body, request)).toBe(request.body)
    expect(getProxyLoggedBody(body)).toBeNull()
  })

  it('restores content length for untouched multipart stream forwarding', async () => {
    const bodyStream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('--dash\r\nmalformed'))
        controller.close()
      },
    })
    const request = new Request('http://dash.test/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'content-type': 'multipart/form-data; boundary=dash', 'content-length': '18' },
      body: bodyStream,
      ...({ duplex: 'half' } as RequestInit),
    })
    const body = await prepareProxyBody(request, 'POST')
    const headers: Record<string, string> = {}

    restoreProxyBodyContentLength(body, request, headers)

    expect(headers['content-length']).toBe('18')
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

  it('rejects bodies over the hard proxy body limit', async () => {
    const request = new Request('http://dash.test/v1/messages', {
      method: 'POST',
      headers: { 'content-length': String(MAX_PROXY_BODY_BYTES + 1) },
      body: '{}',
    })

    await expect(prepareProxyBody(request, 'POST')).rejects.toThrow('Request body exceeds')
  })
})
