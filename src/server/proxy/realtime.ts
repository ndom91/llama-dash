import { STATUS_CODES, type IncomingMessage } from 'node:http'
import type { Duplex } from 'node:stream'
import { type RawData, WebSocket, WebSocketServer } from 'ws'
import { getAttributionSettings } from '../admin/settings.ts'
import { config } from '../config.ts'
import type { ApiKey } from '../db/schema.ts'
import { errorMessage } from '../error-message.ts'
import { inferenceBackend } from '../inference/backend.ts'
import { extractAttribution, type RequestAttribution } from './attribution.ts'
import { enforceAuth, headerApiKeyToken, type KeyResolution, resolveApiKeyToken } from './auth.ts'
import { nullUsage, writeProxyLog } from './forward.ts'
import { deleteGatewayAuthHeaders, filterRequestHeaders, redactSensitiveHeaders } from './headers.ts'
import { recordTokenUsage } from './rate-limiter.ts'
import { resolveProxyRouting, shouldPreserveAuthorization } from './routing.ts'
import { applyTransforms, emptyRoutingOutcome, type RoutingOutcome, routingOutcomeFromDecision } from './transforms.ts'

export const REALTIME_PATH = '/v1/realtime'

// OpenAI SDK convention for browser clients, which cannot set Authorization on a WebSocket.
const KEY_PROTOCOL_PREFIX = 'openai-insecure-api-key.'
const SESSION_MODEL_TIMEOUT_MS = 30_000
// Clients may stream input audio before naming a model in session.update.
const MAX_PENDING_BYTES = 8 * 1024 * 1024
const MAX_UPSTREAM_ERROR_BYTES = 4096
const SESSION_UPDATE_TYPES = new Set(['session.update', 'transcription_session.update'])
const USAGE_EVENT_TYPES = new Set(['response.done', 'conversation.item.input_audio_transcription.completed'])

type RealtimeError = { status: number; message: string; type: string }
type Auth = { keyId: string | null; keyRow: ApiKey | null }

type Session = {
  startedAt: number
  url: URL
  headers: Headers
  offeredProtocols: Array<string>
  loggedHeaders: string
  attribution: RequestAttribution
  keyResolution: KeyResolution
  auth: Auth
  authMode: 'require_key' | 'passthrough'
  routing: RoutingOutcome
  requestedModel: string | null
  model: string | null
  upstreamOpened: boolean
  error: string | null
  failureStatus: number | null
  clientEvents: Map<string, number>
  serverEvents: Map<string, number>
  promptTokens: number | null
  completionTokens: number | null
  totalTokens: number | null
  logged: boolean
}

// Protocol chosen for each pending handshake. ws asks for it via handleProtocols.
const chosenProtocols = new WeakMap<IncomingMessage, string | false>()
const wss = new WebSocketServer({
  noServer: true,
  perMessageDeflate: false,
  handleProtocols: (_protocols, request) => chosenProtocols.get(request) ?? false,
})

export function isRealtimeUpgradePath(rawUrl: string | undefined): boolean {
  if (!rawUrl) return false
  return new URL(rawUrl, 'http://localhost').pathname === REALTIME_PATH
}

/**
 * Handles an HTTP upgrade for `/v1/realtime`. Returns false for every other
 * path so other upgrade consumers (Vite HMR) keep working.
 */
export function handleRealtimeUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer): boolean {
  if (!isRealtimeUpgradePath(req.url)) return false
  socket.on('error', () => {})
  try {
    startSession(req, socket, head)
  } catch (err) {
    console.error('[realtime] upgrade failed', err)
    writeHttpError(socket, 500, { message: errorMessage(err), type: 'internal_error' })
  }
  return true
}

function startSession(req: IncomingMessage, socket: Duplex, head: Buffer) {
  const url = new URL(req.url ?? REALTIME_PATH, 'http://localhost')
  const headers = toHeaders(req.headers)
  const offeredProtocols = parseProtocols(headers.get('sec-websocket-protocol'))
  const keyResolution = resolveApiKeyToken(realtimeKeyToken(headers, offeredProtocols, url))
  const queryModel = url.searchParams.get('model') || null

  const session: Session = {
    startedAt: Date.now(),
    url,
    headers,
    offeredProtocols,
    loggedHeaders: loggedHeaders(headers),
    attribution: extractAttribution(headers, getAttributionSettings()),
    keyResolution,
    auth: { keyId: null, keyRow: null },
    authMode: 'require_key',
    routing: emptyRoutingOutcome(),
    requestedModel: queryModel,
    model: null,
    upstreamOpened: false,
    error: null,
    failureStatus: null,
    clientEvents: new Map(),
    serverEvents: new Map(),
    promptTokens: null,
    completionTokens: null,
    totalTokens: null,
    logged: false,
  }

  const validKeyId = keyResolution.status === 'valid' ? keyResolution.keyRow.id : null
  const decision = resolveProxyRouting(REALTIME_PATH, queryModel ? { model: queryModel } : null, validKeyId, headers)
  session.routing = routingOutcomeFromDecision(decision, queryModel)
  const authResult = enforceAuth(keyResolution, decision.authMode)
  if (!authResult.ok) {
    rejectHandshake(session, socket, {
      status: authResult.status,
      message: authResult.body.error.message,
      type: authResult.body.error.type,
    })
    return
  }
  session.auth = { keyId: authResult.keyId, keyRow: authResult.keyRow }
  session.authMode = decision.authMode

  if (!queryModel) {
    // The model arrives in the first session.update. Accept the client now and
    // connect upstream once the model has passed the same checks as ?model=.
    chosenProtocols.set(req, pickClientProtocol(offeredProtocols, null))
    wss.handleUpgrade(req, socket, head, (client) => bridge(session, client, null))
    return
  }

  const resolved = resolveModel(session, queryModel)
  if ('status' in resolved) {
    rejectHandshake(session, socket, resolved)
    return
  }

  const upstream = connectUpstream(session)
  let settled = false
  const onSocketClose = () => {
    if (settled) return
    settled = true
    session.error = 'Client disconnected before the upstream session opened'
    upstream.terminate()
    finishSession(session)
  }
  socket.once('close', onSocketClose)

  upstream.once('open', () => {
    if (settled) return
    settled = true
    socket.off('close', onSocketClose)
    chosenProtocols.set(req, pickClientProtocol(offeredProtocols, upstream.protocol))
    wss.handleUpgrade(req, socket, head, (client) => bridge(session, client, upstream))
  })
  upstream.once('unexpected-response', (_request, response) => {
    if (settled) return
    settled = true
    socket.off('close', onSocketClose)
    readLimited(response, MAX_UPSTREAM_ERROR_BYTES).then((body) => {
      const status = response.statusCode ?? 502
      session.error = `Upstream rejected the realtime handshake (${status})`
      writeRawHttp(socket, status, response.headers['content-type'] ?? 'text/plain', body)
      finishSession(session, status)
      upstream.terminate()
    })
  })
  upstream.once('error', (err) => {
    if (settled) return
    settled = true
    socket.off('close', onSocketClose)
    rejectHandshake(session, socket, {
      status: 502,
      message: `Upstream unreachable: ${errorMessage(err)}`,
      type: 'upstream_unreachable',
    })
  })
}

// Pipes frames between the client and upstream. With no upstream yet, client
// frames are held until a session.update names a model.
function bridge(session: Session, client: WebSocket, initialUpstream: WebSocket | null) {
  let upstream = initialUpstream
  let upstreamOpen = initialUpstream?.readyState === WebSocket.OPEN
  const pending: Array<{ data: RawData; isBinary: boolean }> = []
  let pendingBytes = 0
  let waitTimer: NodeJS.Timeout | null = null

  const failClient = (error: RealtimeError, closeCode: number) => {
    session.error = error.message
    session.failureStatus = error.status
    sendErrorEvent(client, error)
    client.close(closeCode, truncateReason(error.message))
    upstream?.terminate()
  }

  const attachUpstream = (ws: WebSocket) => {
    ws.on('message', (data, isBinary) => {
      if (!isBinary) tapServerEvent(session, data)
      if (client.readyState === WebSocket.OPEN) client.send(data, { binary: isBinary })
    })
    ws.on('close', (code, reason) => {
      if (code === 1006 || code === 1011) session.error ??= `Upstream closed the session (${code})`
      closeSafely(client, code, reason)
    })
    ws.on('error', (err) => {
      session.error ??= `Upstream error: ${errorMessage(err)}`
    })
  }

  if (upstream) {
    session.upstreamOpened = true
    attachUpstream(upstream)
  } else {
    waitTimer = setTimeout(() => {
      failClient(
        {
          status: 400,
          message: 'No session.update named a model within 30 seconds',
          type: 'session_model_required',
        },
        1008,
      )
    }, SESSION_MODEL_TIMEOUT_MS)
  }

  const openUpstreamForModel = (model: string) => {
    if (waitTimer) clearTimeout(waitTimer)
    session.requestedModel = model
    const resolved = resolveModel(session, model)
    if ('status' in resolved) {
      failClient(resolved, 1008)
      return
    }
    const ws = connectUpstream(session)
    upstream = ws
    ws.once('open', () => {
      session.upstreamOpened = true
      upstreamOpen = true
      for (const frame of pending.splice(0)) ws.send(frame.data, { binary: frame.isBinary })
      pendingBytes = 0
    })
    ws.once('unexpected-response', (_request, response) => {
      readLimited(response, MAX_UPSTREAM_ERROR_BYTES).then((body) => {
        failClient(
          {
            status: response.statusCode ?? 502,
            message: `Upstream rejected the realtime session (${response.statusCode}): ${body.toString('utf8').trim()}`,
            type: 'upstream_error',
          },
          1011,
        )
      })
    })
    ws.once('error', (err) => {
      if (session.upstreamOpened) return
      failClient(
        { status: 502, message: `Upstream unreachable: ${errorMessage(err)}`, type: 'upstream_unreachable' },
        1011,
      )
    })
    attachUpstream(ws)
  }

  client.on('message', (data, isBinary) => {
    const clientEventType = isBinary ? null : eventType(data)
    if (clientEventType) increment(session.clientEvents, clientEventType)

    if (upstream && upstreamOpen) {
      if (upstream.readyState === WebSocket.OPEN) upstream.send(data, { binary: isBinary })
      return
    }

    pendingBytes += rawDataLength(data)
    if (pendingBytes > MAX_PENDING_BYTES) {
      failClient(
        {
          status: 413,
          message: 'Too much data was sent before the realtime session connected',
          type: 'request_too_large',
        },
        1009,
      )
      return
    }
    pending.push({ data, isBinary })

    if (!upstream && clientEventType && SESSION_UPDATE_TYPES.has(clientEventType)) {
      const model = sessionUpdateModel(data)
      if (model) openUpstreamForModel(model)
    }
  })

  client.on('close', (code, reason) => {
    if (waitTimer) clearTimeout(waitTimer)
    if (upstream) {
      if (upstream.readyState === WebSocket.OPEN) closeSafely(upstream, code, reason)
      else if (upstream.readyState === WebSocket.CONNECTING) upstream.terminate()
    }
    finishSession(session)
  })
  client.on('error', () => {})
}

// Runs routing, auth, model ACL, rewrite and alias checks for the session model.
function resolveModel(session: Session, model: string): RealtimeError | { model: string } {
  const validKeyId = session.keyResolution.status === 'valid' ? session.keyResolution.keyRow.id : null
  const decision = resolveProxyRouting(REALTIME_PATH, { model }, validKeyId, session.headers)

  // The handshake was authenticated against the routing decision without a model.
  // A rule that only matches this model may demand a key the handshake did not need.
  if (decision.authMode === 'require_key' && session.authMode === 'passthrough') {
    const authResult = enforceAuth(session.keyResolution, 'require_key')
    if (!authResult.ok) {
      return { status: authResult.status, message: authResult.body.error.message, type: authResult.body.error.type }
    }
    session.auth = { keyId: authResult.keyId, keyRow: authResult.keyRow }
    session.authMode = 'require_key'
  }

  const result = applyTransforms(
    { model },
    { keyRow: session.auth.keyRow, endpoint: REALTIME_PATH, method: 'GET', routingDecision: decision },
  )
  session.routing = result.routing
  if (!result.ok) {
    return { status: result.status, message: result.body.error.message, type: result.body.error.type }
  }
  if (result.routing.targetType === 'direct' || result.routing.credentialBindings.length > 0) {
    return {
      status: 422,
      message: 'Realtime sessions only support llama-swap targets without credential bindings',
      type: 'unsupported_routing_target',
    }
  }

  const resolvedModel = result.body && typeof result.body.model === 'string' ? result.body.model : model
  session.model = resolvedModel
  return { model: resolvedModel }
}

function connectUpstream(session: Session): WebSocket {
  const search = new URLSearchParams(session.url.searchParams)
  search.delete('api_key')
  if (session.model) search.set('model', session.model)
  const httpUrl = inferenceBackend.defaultProxyUpstream(REALTIME_PATH, `?${search.toString()}`)
  const wsUrl = httpUrl.replace(/^http/, 'ws')

  const protocols = session.offeredProtocols.filter((protocol) => !protocol.startsWith(KEY_PROTOCOL_PREFIX))
  return new WebSocket(wsUrl, protocols, {
    headers: upstreamHeaders(session),
    perMessageDeflate: false,
    handshakeTimeout: config.upstreamHeadersTimeoutMs > 0 ? config.upstreamHeadersTimeoutMs : undefined,
  })
}

function upstreamHeaders(session: Session): Record<string, string> {
  const out = filterRequestHeaders(session.headers)
  deleteGatewayAuthHeaders(out)
  for (const key of Object.keys(out)) {
    const lower = key.toLowerCase()
    // ws builds its own handshake headers. The dashboard cookie and browser Origin
    // belong to llama-dash, and llama-server rejects unexpected cross-origin upgrades.
    if (lower.startsWith('sec-websocket-') || lower === 'cookie' || lower === 'origin') delete out[key]
    if (lower === 'authorization' && !shouldPreserveAuthorization(session.routing)) delete out[key]
  }
  return out
}

function finishSession(session: Session, statusOverride?: number) {
  if (session.logged) return
  session.logged = true

  const usage = nullUsage(session.model ?? session.requestedModel)
  usage.promptTokens = session.promptTokens
  usage.completionTokens = session.completionTokens
  usage.totalTokens = session.totalTokens

  const keyRow = session.auth.keyRow
  if (keyRow?.rateLimitTpm != null && session.totalTokens) {
    recordTokenUsage(keyRow.id, keyRow.rateLimitTpm, session.totalTokens)
  }

  writeProxyLog({
    startedAt: session.startedAt,
    status: statusOverride ?? session.failureStatus ?? (session.upstreamOpened ? 200 : 502),
    method: 'GET',
    endpoint: REALTIME_PATH,
    usage,
    streamed: true,
    error: session.error,
    reqHeaders: session.loggedHeaders,
    reqBody: eventSummary(session.clientEvents),
    resHeaders: null,
    resBody: eventSummary(session.serverEvents),
    keyId: session.auth.keyId,
    reqModel: session.model ?? session.requestedModel,
    attribution: session.attribution,
    routing: session.routing,
  })
}

function rejectHandshake(session: Session, socket: Duplex, error: RealtimeError) {
  session.error = error.message
  writeHttpError(socket, error.status, { message: error.message, type: error.type })
  finishSession(session, error.status)
}

// Counts events and sums token usage without buffering or forwarding changes.
function tapServerEvent(session: Session, data: RawData) {
  const type = eventType(data)
  if (!type) return
  increment(session.serverEvents, type)
  if (!USAGE_EVENT_TYPES.has(type)) return

  const event = parseJson(data)
  const usage = readUsage(event)
  if (!usage) return
  session.promptTokens = (session.promptTokens ?? 0) + usage.input
  session.completionTokens = (session.completionTokens ?? 0) + usage.output
  session.totalTokens = (session.totalTokens ?? 0) + usage.total
}

function readUsage(event: unknown): { input: number; output: number; total: number } | null {
  if (!isRecord(event)) return null
  const container = isRecord(event.response) ? event.response : event
  const usage = container.usage
  if (!isRecord(usage)) return null
  const input = numberOr(usage.input_tokens, 0)
  const output = numberOr(usage.output_tokens, 0)
  return { input, output, total: numberOr(usage.total_tokens, input + output) }
}

// Reads the event type from the start of a frame, so large audio frames are not parsed.
function eventType(data: RawData): string | null {
  const head = rawDataPrefix(data, 256)
  const match = /"type"\s*:\s*"([^"]{1,96})"/.exec(head)
  if (match) return match[1]
  const event = parseJson(data)
  return isRecord(event) && typeof event.type === 'string' ? event.type : null
}

// Same lookup order as llama-swap.
function sessionUpdateModel(data: RawData): string | null {
  const event = parseJson(data)
  if (!isRecord(event) || !isRecord(event.session)) return null
  const session = event.session
  const audio = isRecord(session.audio) ? session.audio : null
  const audioInput = audio && isRecord(audio.input) ? audio.input : null
  const audioTranscription = audioInput && isRecord(audioInput.transcription) ? audioInput.transcription : null
  const legacyTranscription = isRecord(session.input_audio_transcription) ? session.input_audio_transcription : null
  for (const candidate of [session.model, audioTranscription?.model, legacyTranscription?.model]) {
    if (typeof candidate === 'string' && candidate) return candidate
  }
  return null
}

function realtimeKeyToken(headers: Headers, protocols: Array<string>, url: URL): string | null {
  const protocolKey = protocols.find((protocol) => protocol.startsWith(KEY_PROTOCOL_PREFIX))
  return (
    headerApiKeyToken(headers) ??
    (protocolKey ? protocolKey.slice(KEY_PROTOCOL_PREFIX.length) : null) ??
    url.searchParams.get('api_key')
  )
}

// Browsers fail the handshake when they offer subprotocols and the server picks
// none, so fall back to one of the offered values.
function pickClientProtocol(offered: Array<string>, upstreamProtocol: string | null): string | false {
  if (upstreamProtocol && offered.includes(upstreamProtocol)) return upstreamProtocol
  return offered.find((protocol) => !protocol.startsWith(KEY_PROTOCOL_PREFIX)) ?? offered[0] ?? false
}

function loggedHeaders(headers: Headers): string {
  const out = filterRequestHeaders(headers)
  for (const key of Object.keys(out)) {
    const lower = key.toLowerCase()
    if (lower === 'sec-websocket-key' || lower === 'sec-websocket-extensions') delete out[key]
    if (lower === 'sec-websocket-protocol') {
      out[key] = parseProtocols(out[key])
        .map((protocol) => (protocol.startsWith(KEY_PROTOCOL_PREFIX) ? `${KEY_PROTOCOL_PREFIX}[redacted]` : protocol))
        .join(', ')
    }
  }
  return JSON.stringify(redactSensitiveHeaders(out))
}

function sendErrorEvent(client: WebSocket, error: RealtimeError) {
  if (client.readyState !== WebSocket.OPEN) return
  client.send(
    JSON.stringify({
      type: 'error',
      error: { type: 'invalid_request_error', code: error.type, message: error.message },
    }),
  )
}

function closeSafely(ws: WebSocket, code: number, reason: Buffer) {
  if (ws.readyState === WebSocket.CLOSING || ws.readyState === WebSocket.CLOSED) return
  if (ws.readyState === WebSocket.CONNECTING) {
    ws.terminate()
    return
  }
  ws.close(sendableCloseCode(code), truncateReason(reason.toString('utf8')))
}

// 1005 and 1006 are reserved for reporting and can't be sent on the wire.
function sendableCloseCode(code: number): number {
  if (code >= 3000 && code <= 4999) return code
  if (code >= 1000 && code <= 1014 && code !== 1004 && code !== 1005 && code !== 1006) return code
  return code === 1006 ? 1011 : 1000
}

// Close reasons are limited to 123 bytes.
function truncateReason(reason: string): string {
  let out = reason
  while (Buffer.byteLength(out) > 123) out = out.slice(0, -1)
  return out
}

function writeHttpError(socket: Duplex, status: number, error: { message: string; type: string }) {
  writeRawHttp(socket, status, 'application/json', Buffer.from(JSON.stringify({ error })))
}

function writeRawHttp(socket: Duplex, status: number, contentType: string, body: Buffer) {
  if (socket.destroyed) return
  socket.end(
    `HTTP/1.1 ${status} ${STATUS_CODES[status] ?? 'Error'}\r\n` +
      `Content-Type: ${contentType}\r\n` +
      `Content-Length: ${body.length}\r\n` +
      'Connection: close\r\n\r\n' +
      body.toString('utf8'),
  )
}

function readLimited(stream: IncomingMessage, limit: number): Promise<Buffer> {
  return new Promise((resolve) => {
    const chunks: Array<Buffer> = []
    let size = 0
    const done = () => resolve(Buffer.concat(chunks).subarray(0, limit))
    stream.on('data', (chunk: Buffer) => {
      if (size >= limit) return
      chunks.push(chunk)
      size += chunk.length
      if (size >= limit) {
        stream.destroy()
        done()
      }
    })
    stream.on('end', done)
    stream.on('error', done)
  })
}

function eventSummary(counts: Map<string, number>): string | null {
  if (counts.size === 0) return null
  return JSON.stringify({ events: Object.fromEntries(counts) })
}

function increment(counts: Map<string, number>, key: string) {
  counts.set(key, (counts.get(key) ?? 0) + 1)
}

function toHeaders(raw: IncomingMessage['headers']): Headers {
  const headers = new Headers()
  for (const [key, value] of Object.entries(raw)) {
    if (value == null) continue
    headers.set(key, Array.isArray(value) ? value.join(', ') : value)
  }
  return headers
}

function parseProtocols(header: string | null | undefined): Array<string> {
  if (!header) return []
  return header
    .split(',')
    .map((protocol) => protocol.trim())
    .filter(Boolean)
}

function rawDataBuffer(data: RawData): Buffer {
  if (Buffer.isBuffer(data)) return data
  if (Array.isArray(data)) return Buffer.concat(data)
  return Buffer.from(data)
}

function rawDataLength(data: RawData): number {
  if (Array.isArray(data)) return data.reduce((sum, chunk) => sum + chunk.length, 0)
  return data.byteLength
}

function rawDataPrefix(data: RawData, bytes: number): string {
  return rawDataBuffer(data).subarray(0, bytes).toString('utf8')
}

function parseJson(data: RawData): unknown {
  try {
    return JSON.parse(rawDataBuffer(data).toString('utf8'))
  } catch {
    return null
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}
