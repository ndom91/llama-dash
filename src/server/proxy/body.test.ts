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

  it('reads multipart routing fields and forwards the original bytes', async () => {
    const raw = multipartBody([
      { name: 'file', filename: 'voice.wav', type: 'audio/wav', value: 'RIFF\r\n--not-a-boundary\0\xff' },
      { name: 'model', value: 'lfm3-audio-2b' },
      { name: 'stream', value: 'false' },
    ])
    const request = multipartRequest(raw)

    const body = await prepareProxyBody(request, 'POST')

    expect(body.isMultipart).toBe(true)
    expect(body.preserveContentLength).toBe(true)
    expect(body.parsedBody).toEqual({ model: 'lfm3-audio-2b', stream: false })
    expect(body.reqModel).toBe('lfm3-audio-2b')
    expect(Buffer.from(getProxyForwardBody(body, request) as Uint8Array).equals(raw)).toBe(true)
    expect(getProxyLoggedBody(body)).toBeNull()
  })

  it('reads the model field from FormData-encoded requests', async () => {
    const form = new FormData()
    form.set('file', new Blob([new Uint8Array([0, 1, 2])], { type: 'audio/wav' }), 'voice.wav')
    form.set('model', 'whisper-large')
    const request = new Request('http://dash.test/v1/audio/transcriptions', { method: 'POST', body: form })

    const body = await prepareProxyBody(request, 'POST')

    expect(body.reqModel).toBe('whisper-large')
  })

  it('splices a rewritten model into the multipart bytes and updates content length', async () => {
    const raw = multipartBody([
      { name: 'model', value: 'alias' },
      { name: 'file', filename: 'voice.wav', type: 'audio/wav', value: 'audio' },
    ])
    const request = multipartRequest(raw)
    const body = await prepareProxyBody(request, 'POST')

    const transformed = applyProxyBodyTransform(body, { mutated: true, body: { model: 'real-model' } })
    const headers: Record<string, string> = {}
    applyProxyBodyHeaders(transformed, headers)
    restoreProxyBodyContentLength(transformed, request, headers)

    const forwarded = Buffer.from(getProxyForwardBody(transformed, request) as Uint8Array)
    expect(forwarded.equals(Buffer.from(raw.toString('latin1').replace('alias', 'real-model'), 'latin1'))).toBe(true)
    expect(headers['content-length']).toBe(String(forwarded.byteLength))
    expect(transformed.reqModel).toBe('real-model')
  })

  it('forwards malformed multipart bodies unchanged without routing fields', async () => {
    const raw = Buffer.from('--dash\r\nmalformed')
    const request = multipartRequest(raw)

    const body = await prepareProxyBody(request, 'POST')

    expect(body.isMultipart).toBe(true)
    expect(body.preserveContentLength).toBe(true)
    expect(body.parsedBody).toBeNull()
    expect(Buffer.from(getProxyForwardBody(body, request) as Uint8Array).equals(raw)).toBe(true)
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

type Part = { name: string; value: string; filename?: string; type?: string }

function multipartBody(parts: Part[], boundary = '----formdata-test'): Buffer {
  const chunks = parts.map((part) => {
    const disposition = `form-data; name="${part.name}"${part.filename ? `; filename="${part.filename}"` : ''}`
    const type = part.type ? `\r\nContent-Type: ${part.type}` : ''
    return `--${boundary}\r\nContent-Disposition: ${disposition}${type}\r\n\r\n${part.value}\r\n`
  })
  return Buffer.from(`${chunks.join('')}--${boundary}--\r\n`, 'latin1')
}

function multipartRequest(raw: Buffer, boundary = '----formdata-test'): Request {
  return new Request('http://dash.test/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      'content-type': `multipart/form-data; boundary=${boundary}`,
      'content-length': String(raw.byteLength),
    },
    body: new Uint8Array(raw),
  })
}
