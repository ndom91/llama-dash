import { createServer } from 'node:http'
import { once } from 'node:events'
import { expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ baseUrl: '', logs: vi.fn() }))
vi.mock('../db/index.ts', () => ({ db: {}, sqliteDb: {}, schema: {} }))
vi.mock('../config.ts', () => ({
  config: {
    inferenceBackend: 'llama-swap',
    get inferenceBaseUrl() {
      return state.baseUrl
    },
    upstreamHeadersTimeoutMs: 600_000,
    upstreamBodyTimeoutMs: 0,
    credentialEncryptionKey: '',
  },
}))
vi.mock('../admin/settings.ts', () => ({
  getAttributionSettings: () => ({ clientNameHeader: null, endUserIdHeader: null, sessionIdHeader: null }),
  getPrivacySettings: () => ({ captureRequestBodies: false, captureResponseBodies: false }),
  getRequestLimits: () => ({ maxMessages: null, maxEstimatedTokens: null }),
}))
vi.mock('../admin/api-keys.ts', () => ({ hasAnyUserKeys: () => false, findKeyByHash: () => undefined }))
vi.mock('../admin/model-aliases.ts', () => ({ resolveAlias: (model: string) => model }))
vi.mock('../admin/routing-rules.ts', async () => {
  const actual = await vi.importActual<typeof import('../admin/routing-rules.ts')>('../admin/routing-rules.ts')
  return { ...actual, listRoutingRules: () => [] }
})
vi.mock('../admin/upstream-credentials.ts', () => ({
  getCredentialAuthorizationHeader: () => null,
  getCredentialInjectionSecret: () => null,
  markCredentialUsed: vi.fn(),
}))
vi.mock('./log.ts', () => ({ writeRequestLog: state.logs }))
vi.mock('./rate-limiter.ts', () => ({
  checkRpm: () => ({ allowed: true }),
  checkTpm: () => ({ allowed: true }),
  recordTokenUsage: vi.fn(),
}))

it('forwards native TTS to a model-specific upstream and preserves binary audio', async () => {
  const wav = Buffer.from([0x52, 0x49, 0x46, 0x46, 0, 0xff, 0x80, 0x00, 0x57, 0x41, 0x56, 0x45])
  let path = ''
  let body = ''
  const upstream = createServer((req, res) => {
    path = req.url ?? ''
    req.setEncoding('utf8')
    req.on('data', (chunk: string) => {
      body += chunk
    })
    req.on('end', () => {
      res.writeHead(200, { 'content-type': 'audio/wav' })
      res.end(wav)
    })
  })
  upstream.listen(0, '127.0.0.1')
  await once(upstream, 'listening')
  const address = upstream.address()
  if (!address || typeof address === 'string') throw new Error('No upstream port')
  state.baseUrl = `http://127.0.0.1:${address.port}`
  try {
    const { handleProxyRequest } = await import('./handler')
    const response = await handleProxyRequest(
      new Request('http://dash.test/v1/audio/llama-tts', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ model: 'lfm3-audio-2b', input: 'Hello' }),
      }),
    )
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('audio/wav')
    expect(Buffer.from(await response.arrayBuffer())).toEqual(wav)
    expect(path).toBe('/upstream/lfm3-audio-2b/v1/audio/speech')
    expect(JSON.parse(body)).toEqual({ model: 'lfm3-audio-2b', input: 'Hello' })
    expect(state.logs).toHaveBeenCalledWith(
      expect.objectContaining({ endpoint: '/v1/audio/llama-tts', statusCode: 200 }),
    )
  } finally {
    upstream.closeAllConnections()
    upstream.close()
    await once(upstream, 'close')
  }
})
