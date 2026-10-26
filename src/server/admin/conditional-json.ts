import { createHash } from 'node:crypto'

export function json(status: number, value: unknown, options: { noStore?: boolean } = {}): Response {
  const body = JSON.stringify(value)
  const headers = new Headers({
    'content-type': 'application/json',
    'content-length': String(Buffer.byteLength(body)),
    'cache-control': options.noStore ? 'no-store' : 'private, no-cache',
  })
  if (status === 200 && !options.noStore) {
    headers.set('etag', `W/"${createHash('sha256').update(body).digest('base64url')}"`)
  }
  return new Response(body, { status, headers })
}

export function withConditionalGet(request: Request, response: Response): Response {
  if (request.method !== 'GET' || response.status !== 200) return response
  if (response.headers.get('cache-control')?.includes('no-store')) return response
  const etag = response.headers.get('etag')
  if (!etag) return response
  const tags = request.headers.get('if-none-match')?.split(',') ?? []
  const matches = tags.some((tag) => tag.trim() === '*' || tag.trim().replace(/^W\//, '') === etag.replace(/^W\//, ''))
  if (!matches) return response
  return new Response(null, {
    status: 304,
    headers: { etag, 'cache-control': response.headers.get('cache-control') ?? 'private, no-cache' },
  })
}
