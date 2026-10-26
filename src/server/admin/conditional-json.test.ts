import { expect, it, vi } from 'vitest'
import { json, withConditionalGet } from './conditional-json'

function get(etag?: string, method = 'GET') {
  return new Request('http://localhost/api/test', { method, headers: etag ? { 'if-none-match': etag } : {} })
}

it('serializes once and never rereads a JSON response to calculate its validator', async () => {
  const toJSON = vi.fn(() => ({ text: 'héllo 🦙' }))
  const response = json(200, { toJSON })
  const read = vi.spyOn(response, 'text')
  expect(withConditionalGet(get(), response)).toBe(response)
  expect(read).not.toHaveBeenCalled()
  expect(toJSON).toHaveBeenCalledOnce()
  const text = await response.text()
  expect(Number(response.headers.get('content-length'))).toBe(Buffer.byteLength(text))
  expect(response.headers.get('cache-control')).toBe('private, no-cache')
})

it('returns bodyless 304s for matching weak, strong, list and wildcard validators', async () => {
  const tag = json(200, { a: 1 }).headers.get('etag')!
  for (const validator of [tag, tag.replace(/^W\//, ''), `"other", ${tag}`, '*']) {
    const response = withConditionalGet(get(validator), json(200, { a: 1 }))
    expect(response.status).toBe(304)
    expect(await response.text()).toBe('')
    expect(response.headers.has('content-length')).toBe(false)
  }
  expect(withConditionalGet(get(tag), json(200, { a: 2 })).status).toBe(200)
})

it('skips validators for sensitive payloads and does not condition mutations or errors', () => {
  const sensitive = json(200, { secret: 'payload' }, { noStore: true })
  expect(sensitive.headers.has('etag')).toBe(false)
  expect(withConditionalGet(get('*'), sensitive).status).toBe(200)
  expect(withConditionalGet(get('*', 'POST'), json(200, {})).status).toBe(200)
  expect(withConditionalGet(get('*'), json(404, {})).status).toBe(404)
})
