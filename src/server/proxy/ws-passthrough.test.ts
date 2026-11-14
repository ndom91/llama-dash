import { createHash } from 'node:crypto'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { WebSocket, WebSocketServer } from 'ws'
import type { ApiKey } from '../db/schema'

const configMock = vi.hoisted(() => ({
  config: {
    inferenceBackend: 'llama-swap',
    inferenceBaseUrl: 'http://127.0.0.1:1',
    inferenceInsecure: false,
    inferenceConfigFile: '',
    databasePath: ':memory:',
    credentialEncryptionKey: 'x'.repeat(32),
    upstreamHeadersTimeoutMs: 5000,
  },
}))
vi.mock('../config.ts', () => configMock)
vi.mock('../admin/settings.ts', () => ({
  getAttributionSettings: () => ({ clientHeader: '', endUserHeader: '', sessionHeader: '' }),
  getPrivacySettings: () => ({ captureRequestBodies: true, captureResponseBodies: true, maxStoredBodyBytes: 0 }),
  getRequestLimits: () => ({ maxMessages: null, maxEstimatedTokens: null }),
}))
vi.mock('../admin/model-aliases.ts', () => ({ resolveAlias: (model: string) => model }))
vi.mock('../admin/routing-rules.ts', async () => {
  const actual = await vi.importActual<typeof import('../admin/routing-rules.ts')>('../admin/routing-rules.ts')
  return { ...actual, listRoutingRules: () => [] }
})
const apiKeysMock = vi.hoisted(() => ({
  hasAnyUserKeys: vi.fn(() => true),
  findKeyByHash: vi.fn<(hash: string) => ApiKey | undefined>(() => undefined),
}))
vi.mock('../admin/api-keys.ts', () => apiKeysMock)
const logsMock = vi.hoisted(() => ({ writeRequestLog: vi.fn() }))
vi.mock('./log.ts', () => logsMock)
vi.mock('./rate-limiter.ts', () => ({
  checkRpm: () => ({ allowed: true }),
  checkTpm: () => ({ allowed: true }),
  recordTokenUsage: vi.fn(),
}))

import { handleProxyUpgrade } from './upgrade'

const RAW_KEY = 'sk-comfy-test-key'
const KEY: ApiKey = {
  id: 'key_test',
  name: 'Test key',
  keyHash: createHash('sha256').update(RAW_KEY).digest('hex'),
  keyPrefix: RAW_KEY.slice(0, 8),
  createdAt: new Date(0),
  disabledAt: null,
  expiresAt: null,
  modelAccessMode: 'all',
  allowedModels: '[]',
  allowedMcpRelays: '[]',
  rateLimitRpm: null,
  rateLimitTpm: null,
  monthlyTokenQuota: null,
  defaultModel: null,
  systemPrompt: null,
  system: false,
}

let upstreamHttp: Server
let upstreamWss: WebSocketServer
let proxyHttp: Server
let proxyPort: number
const upstreamUrls: Array<string> = []

beforeAll(async () => {
  upstreamHttp = createServer()
  upstreamWss = new WebSocketServer({ server: upstreamHttp })
  upstreamWss.on('connection', (ws, req) => {
    upstreamUrls.push(req.url ?? '')
    ws.on('message', (data, isBinary) => ws.send(data, { binary: isBinary }))
  })
  await new Promise<void>((resolve) => upstreamHttp.listen(0, '127.0.0.1', resolve))
  configMock.config.inferenceBaseUrl = `http://127.0.0.1:${(upstreamHttp.address() as AddressInfo).port}`

  proxyHttp = createServer((_req, res) => res.end())
  proxyHttp.on('upgrade', (req, socket, head) => {
    if (!handleProxyUpgrade(req, socket, head)) socket.destroy()
  })
  await new Promise<void>((resolve) => proxyHttp.listen(0, '127.0.0.1', resolve))
  proxyPort = (proxyHttp.address() as AddressInfo).port
})

afterAll(async () => {
  upstreamWss.close()
  await new Promise((resolve) => upstreamHttp.close(resolve))
  await new Promise((resolve) => proxyHttp.close(resolve))
})

beforeEach(() => {
  upstreamUrls.length = 0
  logsMock.writeRequestLog.mockReset()
  apiKeysMock.findKeyByHash.mockImplementation((hash) => (hash === KEY.keyHash ? KEY : undefined))
})

function lastLogRow() {
  const calls = logsMock.writeRequestLog.mock.calls
  return calls[calls.length - 1]?.[0]
}

describe('WebSocket passthrough (/comfyui/ws)', () => {
  it('rejects a handshake without an API key', async () => {
    const ws = new WebSocket(`ws://127.0.0.1:${proxyPort}/comfyui/ws?clientId=abc`)
    const status = await new Promise<number>((resolve) =>
      ws.once('unexpected-response', (_q, res) => resolve(res.statusCode ?? 0)),
    )
    expect(status).toBe(401)
    expect(upstreamUrls).toHaveLength(0)
    await vi.waitFor(() => expect(lastLogRow()?.statusCode).toBe(401))
  })

  it('pipes frames both ways and logs one row when the session closes', async () => {
    const ws = new WebSocket(`ws://127.0.0.1:${proxyPort}/comfyui/ws?clientId=abc&api_key=${RAW_KEY}`)
    await new Promise((resolve, reject) => {
      ws.once('open', resolve)
      ws.once('error', reject)
    })
    const echoed = new Promise<string>((resolve) => ws.once('message', (data) => resolve(data.toString())))
    ws.send('{"type":"ping"}')
    expect(await echoed).toBe('{"type":"ping"}')
    expect(upstreamUrls).toEqual(['/comfyui/ws?clientId=abc'])

    ws.close(1000)
    await vi.waitFor(() => expect(logsMock.writeRequestLog).toHaveBeenCalledTimes(1))
    expect(lastLogRow()).toMatchObject({ endpoint: '/comfyui/ws', statusCode: 200, keyId: 'key_test', streamed: true })
    expect(JSON.stringify(lastLogRow())).not.toContain(RAW_KEY)
  })

  it('leaves other upgrade paths alone', () => {
    expect(handleProxyUpgrade({ url: '/@vite/hmr' } as never, {} as never, Buffer.alloc(0))).toBe(false)
  })
})
