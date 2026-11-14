import { createHash } from 'node:crypto'
import { createServer, type IncomingMessage, type Server } from 'node:http'
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

vi.mock('../admin/model-aliases.ts', () => ({
  resolveAlias: (model: string) => (model === 'voice' ? 'lfm3-audio' : model),
}))

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

import { handleRealtimeUpgrade } from './realtime'

const RAW_KEY = 'sk-realtime-test-key'

function makeKey(overrides: Partial<ApiKey> = {}): ApiKey {
  return {
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
    ...overrides,
  }
}

type UpstreamConnection = { url: string; headers: IncomingMessage['headers']; received: Array<string> }

let upstreamHttp: Server
let upstreamWss: WebSocketServer
let proxyHttp: Server
let proxyPort: number
const upstreamConnections: Array<UpstreamConnection> = []

beforeAll(async () => {
  upstreamHttp = createServer()
  upstreamWss = new WebSocketServer({ server: upstreamHttp })
  upstreamWss.on('connection', (ws, req) => {
    const connection: UpstreamConnection = { url: req.url ?? '', headers: req.headers, received: [] }
    upstreamConnections.push(connection)
    ws.send(JSON.stringify({ type: 'session.created', session: { model: 'lfm3-audio' } }))
    ws.on('message', (data) => {
      const text = data.toString()
      connection.received.push(text)
      if (JSON.parse(text).type === 'response.create') {
        ws.send(JSON.stringify({ type: 'response.output_audio.delta', delta: 'AAAA' }))
        ws.send(
          JSON.stringify({
            type: 'response.done',
            response: { usage: { input_tokens: 12, output_tokens: 30, total_tokens: 42 } },
          }),
        )
      }
    })
  })
  await new Promise<void>((resolve) => upstreamHttp.listen(0, '127.0.0.1', resolve))
  configMock.config.inferenceBaseUrl = `http://127.0.0.1:${(upstreamHttp.address() as AddressInfo).port}`

  proxyHttp = createServer((_req, res) => res.end())
  proxyHttp.on('upgrade', (req, socket, head) => {
    if (!handleRealtimeUpgrade(req, socket, head)) socket.destroy()
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
  upstreamConnections.length = 0
  logsMock.writeRequestLog.mockReset()
  apiKeysMock.hasAnyUserKeys.mockReturnValue(true)
  apiKeysMock.findKeyByHash.mockImplementation((hash) => (hash === makeKey().keyHash ? makeKey() : undefined))
})

function connect(path: string, protocols: Array<string> = [], headers: Record<string, string> = {}) {
  return new WebSocket(`ws://127.0.0.1:${proxyPort}${path}`, protocols, { headers })
}

function handshakeStatus(ws: WebSocket): Promise<number> {
  return new Promise((resolve, reject) => {
    ws.once('unexpected-response', (_req, res) => resolve(res.statusCode ?? 0))
    ws.once('open', () => reject(new Error('expected the handshake to fail')))
  })
}

function opened(ws: WebSocket): Promise<void> {
  return new Promise((resolve, reject) => {
    ws.once('open', () => resolve())
    ws.once('error', reject)
  })
}

function collect(ws: WebSocket): Array<Record<string, unknown>> {
  const events: Array<Record<string, unknown>> = []
  ws.on('message', (data) => events.push(JSON.parse(data.toString())))
  return events
}

function closed(ws: WebSocket): Promise<number> {
  return new Promise((resolve) => ws.once('close', (code) => resolve(code)))
}

function lastLogRow() {
  const calls = logsMock.writeRequestLog.mock.calls
  return calls[calls.length - 1]?.[0]
}

describe('handleRealtimeUpgrade', () => {
  it('ignores other upgrade paths', () => {
    const req = { url: '/@vite/hmr' } as IncomingMessage
    expect(handleRealtimeUpgrade(req, {} as never, Buffer.alloc(0))).toBe(false)
  })

  it('rejects a handshake without an API key', async () => {
    const status = await handshakeStatus(connect('/v1/realtime?model=lfm3-audio'))
    expect(status).toBe(401)
    await vi.waitFor(() => expect(lastLogRow()?.statusCode).toBe(401))
    expect(upstreamConnections).toHaveLength(0)
  })

  it('proxies frames, sums usage and logs one row per session', async () => {
    const ws = connect('/v1/realtime?model=voice', ['realtime', `openai-insecure-api-key.${RAW_KEY}`])
    const events = collect(ws)
    await opened(ws)
    expect(ws.protocol).toBe('realtime')

    ws.send(JSON.stringify({ type: 'response.create' }))
    await vi.waitFor(() => expect(events.map((event) => event.type)).toContain('response.done'))

    const upstream = upstreamConnections[0]
    expect(upstream.url).toBe('/v1/realtime?model=lfm3-audio')
    expect(upstream.headers['sec-websocket-protocol']).toBe('realtime')
    expect(upstream.received).toEqual([JSON.stringify({ type: 'response.create' })])

    ws.close(1000)
    await vi.waitFor(() => expect(logsMock.writeRequestLog).toHaveBeenCalledTimes(1))
    const row = lastLogRow()
    expect(row).toMatchObject({
      statusCode: 200,
      endpoint: '/v1/realtime',
      model: 'lfm3-audio',
      keyId: 'key_test',
      promptTokens: 12,
      completionTokens: 30,
      totalTokens: 42,
      streamed: true,
      error: null,
    })
    expect(row.requestHeaders).not.toContain(RAW_KEY)
    expect(JSON.parse(row.responseBody).events['response.done']).toBe(1)
  })

  it('accepts the key from ?api_key= and strips it upstream', async () => {
    const ws = connect(`/v1/realtime?model=lfm3-audio&api_key=${RAW_KEY}`)
    await opened(ws)
    expect(upstreamConnections[0].url).toBe('/v1/realtime?model=lfm3-audio')
    ws.close()
    await vi.waitFor(() => expect(lastLogRow()?.keyId).toBe('key_test'))
    expect(JSON.stringify(lastLogRow())).not.toContain(RAW_KEY)
  })

  it('rejects a model the key may not use before upgrading', async () => {
    apiKeysMock.findKeyByHash.mockReturnValue(makeKey({ modelAccessMode: 'restricted', allowedModels: '["other"]' }))
    const status = await handshakeStatus(
      connect('/v1/realtime?model=lfm3-audio', [], { authorization: `Bearer ${RAW_KEY}` }),
    )
    expect(status).toBe(403)
    expect(upstreamConnections).toHaveLength(0)
  })

  it('waits for session.update to name the model, then replays buffered frames in order', async () => {
    const ws = connect('/v1/realtime?intent=transcription', [], { 'x-llama-dash-api-key': RAW_KEY })
    const events = collect(ws)
    await opened(ws)

    const append = JSON.stringify({ type: 'input_audio_buffer.append', audio: 'AAAA' })
    const update = JSON.stringify({
      type: 'session.update',
      session: { audio: { input: { transcription: { model: 'voice' } } } },
    })
    ws.send(append)
    ws.send(update)

    await vi.waitFor(() => expect(upstreamConnections[0]?.received).toEqual([append, update]))
    expect(upstreamConnections[0].url).toBe('/v1/realtime?intent=transcription&model=lfm3-audio')
    await vi.waitFor(() => expect(events.map((event) => event.type)).toContain('session.created'))

    ws.close()
    await vi.waitFor(() => expect(lastLogRow()?.statusCode).toBe(200))
  })

  it('closes with an error event when session.update names a disallowed model', async () => {
    apiKeysMock.findKeyByHash.mockReturnValue(makeKey({ modelAccessMode: 'restricted', allowedModels: '["other"]' }))
    const ws = connect('/v1/realtime', [], { 'x-llama-dash-api-key': RAW_KEY })
    const events = collect(ws)
    await opened(ws)

    ws.send(JSON.stringify({ type: 'session.update', session: { model: 'lfm3-audio' } }))
    expect(await closed(ws)).toBe(1008)
    expect(events[0]).toMatchObject({ type: 'error', error: { code: 'model_not_allowed' } })
    expect(upstreamConnections).toHaveLength(0)
    await vi.waitFor(() => expect(lastLogRow()?.statusCode).toBe(403))
  })

  it('caps data buffered before the model is known', async () => {
    const ws = connect('/v1/realtime', [], { 'x-llama-dash-api-key': RAW_KEY })
    await opened(ws)
    ws.send(Buffer.alloc(9 * 1024 * 1024), { binary: true })
    expect(await closed(ws)).toBe(1009)
    await vi.waitFor(() => expect(lastLogRow()?.statusCode).toBe(413))
  })
})
