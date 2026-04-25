import { describe, expect, it } from 'vitest'
import { prepareProxyBody } from './body'

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
  })
})
