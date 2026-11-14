import { STATUS_CODES, type IncomingMessage } from 'node:http'
import type { Duplex } from 'node:stream'
import { WebSocket, WebSocketServer } from 'ws'
import { config } from '../config.ts'
import { headerApiKeyToken } from './auth.ts'
import { deleteGatewayAuthHeaders, filterRequestHeaders, redactSensitiveHeaders } from './headers.ts'

// Shared plumbing for the proxied WebSocket endpoints (/v1/realtime, /comfyui/ws).

// OpenAI SDK convention for browser clients, which cannot set Authorization on a WebSocket.
export const KEY_PROTOCOL_PREFIX = 'openai-insecure-api-key.'
export const MAX_UPSTREAM_ERROR_BYTES = 4096

// Protocol chosen for each pending handshake. ws asks for it via handleProtocols.
const chosenProtocols = new WeakMap<IncomingMessage, string | false>()
const wss = new WebSocketServer({
  noServer: true,
  perMessageDeflate: false,
  handleProtocols: (_protocols, request) => chosenProtocols.get(request) ?? false,
})

/** Completes the client handshake, answering with one of the offered subprotocols. */
export function acceptUpgrade(
  req: IncomingMessage,
  socket: Duplex,
  head: Buffer,
  offeredProtocols: Array<string>,
  onOpen: (client: WebSocket) => void,
) {
  chosenProtocols.set(req, pickClientProtocol(offeredProtocols))
  wss.handleUpgrade(req, socket, head, onOpen)
}

/**
 * Opens the upstream WebSocket. No subprotocols are offered: llama-server
 * selects none, and ws rejects a handshake that offered some but got none back.
 */
export function connectUpstreamSocket(httpUrl: string, headers: Record<string, string>): WebSocket {
  return new WebSocket(httpUrl.replace(/^http/, 'ws'), {
    headers,
    perMessageDeflate: false,
    handshakeTimeout: config.upstreamHeadersTimeoutMs > 0 ? config.upstreamHeadersTimeoutMs : undefined,
  })
}

export function upstreamSocketHeaders(headers: Headers, preserveAuthorization: boolean): Record<string, string> {
  const out = filterRequestHeaders(headers)
  deleteGatewayAuthHeaders(out)
  for (const key of Object.keys(out)) {
    const lower = key.toLowerCase()
    // ws builds its own handshake headers. The dashboard cookie and browser Origin
    // belong to llama-dash, and llama-server rejects unexpected cross-origin upgrades.
    if (lower.startsWith('sec-websocket-') || lower === 'cookie' || lower === 'origin') delete out[key]
    if (lower === 'authorization' && !preserveAuthorization) delete out[key]
  }
  return out
}

/** The upstream query: the client's params without the ?api_key= credential. */
export function upstreamSearch(url: URL): URLSearchParams {
  const search = new URLSearchParams(url.searchParams)
  search.delete('api_key')
  return search
}

export function wsKeyToken(headers: Headers, protocols: Array<string>, url: URL): string | null {
  const protocolKey = protocols.find((protocol) => protocol.startsWith(KEY_PROTOCOL_PREFIX))
  return (
    headerApiKeyToken(headers) ??
    (protocolKey ? protocolKey.slice(KEY_PROTOCOL_PREFIX.length) : null) ??
    url.searchParams.get('api_key')
  )
}

// Browsers fail the handshake when they offer subprotocols and the server picks
// none, so fall back to one of the offered values.
export function pickClientProtocol(offered: Array<string>): string | false {
  return offered.find((protocol) => !protocol.startsWith(KEY_PROTOCOL_PREFIX)) ?? offered[0] ?? false
}

export function loggedHeaders(headers: Headers): string {
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

export function closeSafely(ws: WebSocket, code: number, reason: Buffer) {
  if (ws.readyState === WebSocket.CLOSING || ws.readyState === WebSocket.CLOSED) return
  if (ws.readyState === WebSocket.CONNECTING) {
    ws.terminate()
    return
  }
  ws.close(sendableCloseCode(code), truncateReason(reason.toString('utf8')))
}

// 1005 and 1006 are reserved for reporting and can't be sent on the wire.
export function sendableCloseCode(code: number): number {
  if (code >= 3000 && code <= 4999) return code
  if (code >= 1000 && code <= 1014 && code !== 1004 && code !== 1005 && code !== 1006) return code
  return code === 1006 ? 1011 : 1000
}

// Close reasons are limited to 123 bytes.
export function truncateReason(reason: string): string {
  let out = reason
  while (Buffer.byteLength(out) > 123) out = out.slice(0, -1)
  return out
}

export function writeHttpError(socket: Duplex, status: number, error: { message: string; type: string }) {
  writeRawHttp(socket, status, 'application/json', Buffer.from(JSON.stringify({ error })))
}

export function writeRawHttp(socket: Duplex, status: number, contentType: string, body: Buffer) {
  if (socket.destroyed) return
  socket.end(
    `HTTP/1.1 ${status} ${STATUS_CODES[status] ?? 'Error'}\r\n` +
      `Content-Type: ${contentType}\r\n` +
      `Content-Length: ${body.length}\r\n` +
      'Connection: close\r\n\r\n' +
      body.toString('utf8'),
  )
}

export function readLimited(stream: IncomingMessage, limit: number): Promise<Buffer> {
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

export function toHeaders(raw: IncomingMessage['headers']): Headers {
  const headers = new Headers()
  for (const [key, value] of Object.entries(raw)) {
    if (value == null) continue
    headers.set(key, Array.isArray(value) ? value.join(', ') : value)
  }
  return headers
}

export function parseProtocols(header: string | null | undefined): Array<string> {
  if (!header) return []
  return header
    .split(',')
    .map((protocol) => protocol.trim())
    .filter(Boolean)
}
