import { afterEach, expect, it, vi } from 'vitest'
import { api } from './api'

afterEach(() => vi.unstubAllGlobals())

const list = (nextCursor: string | null = null) => ({ requests: [], nextCursor })
const response = (value: unknown, headers: HeadersInit = { etag: 'W/"test"' }) =>
  new Response(JSON.stringify(value), { headers })

it('reuses validated parsed data on a 304 without a second parse', async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(response(list('cached')))
    .mockResolvedValueOnce(new Response(null, { status: 304 }))
  vi.stubGlobal('fetch', fetch)
  const first = await api.listRequests({ cursor: 'cache-identity' })
  const second = await api.listRequests({ cursor: 'cache-identity' })
  expect(second).toBe(first)
  expect(new Headers(fetch.mock.calls[1][1].headers).get('if-none-match')).toBe('W/"test"')
})

it('pins the validator snapshot for an in-flight request even after LRU eviction', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => response(list('original'))),
  )
  await api.listRequests({ cursor: 'snapshot' })
  let resolve!: (response: Response) => void
  const pending = new Promise<Response>((done) => {
    resolve = done
  })
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockImplementation((url: string) =>
        url.includes('cursor=snapshot') ? pending : Promise.resolve(response(list('new'))),
      ),
  )
  const revalidate = api.listRequests({ cursor: 'snapshot' })
  for (let i = 0; i < 130; i++) await api.listRequests({ cursor: `eviction-${i}` })
  resolve(new Response(null, { status: 304 }))
  expect((await revalidate).nextCursor).toBe('original')
})

it('honors no-store and clears validators after mutations and unauthorized responses', async () => {
  const fetch = vi.fn(async (_url: RequestInfo | URL, _options?: RequestInit) =>
    response(list(), { etag: 'W/"private"', 'cache-control': 'no-store' }),
  )
  vi.stubGlobal('fetch', fetch)
  await api.listRequests({ cursor: 'no-store' })
  await api.listRequests({ cursor: 'no-store' })
  expect(new Headers(fetch.mock.calls[1][1]?.headers).has('if-none-match')).toBe(false)

  fetch.mockResolvedValue(response(list()))
  await api.listRequests({ cursor: 'mutation' })
  fetch.mockResolvedValue(response({ ok: true }))
  await api.unloadAll()
  fetch.mockResolvedValue(response(list()))
  await api.listRequests({ cursor: 'mutation' })
  expect(new Headers(fetch.mock.lastCall?.[1]?.headers).has('if-none-match')).toBe(false)

  fetch.mockResolvedValue(new Response('Unauthorized', { status: 401 }))
  await expect(api.listRequests({ cursor: 'denied' })).rejects.toThrow('401')
  fetch.mockResolvedValue(response(list()))
  await api.listRequests({ cursor: 'mutation' })
  expect(new Headers(fetch.mock.lastCall?.[1]?.headers).has('if-none-match')).toBe(false)
})

it('passes interactive/speculative priority and abort signals to fetch', async () => {
  const fetch = vi.fn(async (_url: RequestInfo | URL, _options?: RequestInit) => response(list()))
  vi.stubGlobal('fetch', fetch)
  const controller = new AbortController()
  await api.listRequests({ cursor: 'priority-high' }, { signal: controller.signal })
  expect(fetch.mock.lastCall?.[1]).toMatchObject({ priority: 'high', signal: controller.signal })
  await api.listRequests({ cursor: 'priority-low' }, { priority: 'low' })
  expect(fetch.mock.lastCall?.[1]).toMatchObject({ priority: 'low' })
})

it('clears validators explicitly after validated JSON mutations but not failed ones', async () => {
  const fetch = vi.fn()
  vi.stubGlobal('fetch', fetch)
  fetch.mockResolvedValueOnce(response(list('before-mutation')))
  const original = await api.listRequests({ cursor: 'json-mutation' })
  fetch.mockResolvedValueOnce(response({ ok: false }))
  await expect(api.renameKey('key_fixture', 'renamed')).rejects.toThrow()
  fetch.mockResolvedValueOnce(new Response(null, { status: 304 }))
  expect(await api.listRequests({ cursor: 'json-mutation' })).toBe(original)
  fetch.mockResolvedValueOnce(response({ ok: true }))
  await api.renameKey('key_fixture', 'renamed')
  fetch.mockResolvedValueOnce(response(list()))
  await api.listRequests({ cursor: 'json-mutation' })
  expect(new Headers(fetch.mock.lastCall?.[1]?.headers).has('if-none-match')).toBe(false)
})
