import type { IncomingMessage } from 'node:http'
import type { Duplex } from 'node:stream'
import { getAttributionSettings } from '../admin/settings.ts'
import { errorMessage } from '../error-message.ts'
import { inferenceBackend } from '../inference/backend.ts'
import { extractAttribution } from './attribution.ts'
import { enforceAuth, resolveApiKeyToken } from './auth.ts'
import { nullUsage, writeProxyLog } from './forward.ts'
import { resolveProxyRouting, shouldPreserveAuthorization } from './routing.ts'
import { routingOutcomeFromDecision } from './transforms.ts'
import {
  acceptUpgrade,
  closeSafely,
  connectUpstreamSocket,
  loggedHeaders,
  MAX_UPSTREAM_ERROR_BYTES,
  parseProtocols,
  readLimited,
  toHeaders,
  upstreamSearch,
  upstreamSocketHeaders,
  writeHttpError,
  writeRawHttp,
  wsKeyToken,
} from './ws-common.ts'

/**
 * Pipes a WebSocket to llama-swap unchanged, for UI passthroughs such as
 * ComfyUI's /comfyui/ws progress socket. Auth and routing rules apply as for
 * HTTP; there is no model to resolve and frames are not inspected. One request
 * row is logged when the session closes.
 */
export function handleWsPassthroughUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer) {
  const startedAt = Date.now()
  const url = new URL(req.url ?? '/', 'http://localhost')
  const endpoint = url.pathname
  const headers = toHeaders(req.headers)
  const offeredProtocols = parseProtocols(headers.get('sec-websocket-protocol'))
  const keyResolution = resolveApiKeyToken(wsKeyToken(headers, offeredProtocols, url))
  const validKeyId = keyResolution.status === 'valid' ? keyResolution.keyRow.id : null
  const decision = resolveProxyRouting(endpoint, null, validKeyId, headers)
  const routing = routingOutcomeFromDecision(decision, null)

  let keyId: string | null = null
  let opened = false
  let error: string | null = null
  let logged = false
  const finish = (status: number) => {
    if (logged) return
    logged = true
    writeProxyLog({
      startedAt,
      status,
      method: 'GET',
      endpoint,
      usage: nullUsage(null),
      streamed: true,
      error,
      reqHeaders: loggedHeaders(headers),
      reqBody: null,
      resHeaders: null,
      resBody: null,
      keyId,
      reqModel: null,
      attribution: extractAttribution(headers, getAttributionSettings()),
      routing,
    })
  }
  const reject = (status: number, message: string, type: string) => {
    error = message
    writeHttpError(socket, status, { message, type })
    finish(status)
  }

  const auth = enforceAuth(keyResolution, decision.authMode)
  if (!auth.ok) {
    reject(auth.status, auth.body.error.message, auth.body.error.type)
    return
  }
  keyId = auth.keyId
  if (decision.action?.type === 'reject') {
    reject(422, decision.action.reason, 'routing_rule_rejected')
    return
  }
  if (routing.targetType === 'direct' || routing.credentialBindings.length > 0) {
    reject(
      422,
      'WebSocket passthrough only supports llama-swap targets without credential bindings',
      'unsupported_routing_target',
    )
    return
  }

  const search = upstreamSearch(url).toString()
  const upstream = connectUpstreamSocket(
    inferenceBackend.defaultProxyUpstream(endpoint, search ? `?${search}` : ''),
    upstreamSocketHeaders(headers, shouldPreserveAuthorization(routing)),
  )

  let settled = false
  const onSocketClose = () => {
    if (settled) return
    settled = true
    error = 'Client disconnected before the upstream socket opened'
    upstream.terminate()
    finish(502)
  }
  socket.once('close', onSocketClose)

  upstream.once('open', () => {
    if (settled) return
    settled = true
    socket.off('close', onSocketClose)
    opened = true
    acceptUpgrade(req, socket, head, offeredProtocols, (client) => {
      upstream.on('message', (data, isBinary) => {
        if (client.readyState === client.OPEN) client.send(data, { binary: isBinary })
      })
      client.on('message', (data, isBinary) => {
        if (upstream.readyState === upstream.OPEN) upstream.send(data, { binary: isBinary })
      })
      upstream.on('close', (code, reason) => {
        if (code === 1006 || code === 1011) error ??= `Upstream closed the session (${code})`
        closeSafely(client, code, reason)
      })
      upstream.on('error', (err) => {
        error ??= `Upstream error: ${errorMessage(err)}`
      })
      client.on('close', (code, reason) => {
        closeSafely(upstream, code, reason)
        finish(opened ? 200 : 502)
      })
      client.on('error', () => {})
    })
  })
  upstream.once('unexpected-response', (_request, response) => {
    if (settled) return
    settled = true
    socket.off('close', onSocketClose)
    readLimited(response, MAX_UPSTREAM_ERROR_BYTES).then((body) => {
      const status = response.statusCode ?? 502
      error = `Upstream rejected the WebSocket handshake (${status})`
      writeRawHttp(socket, status, response.headers['content-type'] ?? 'text/plain', body)
      finish(status)
      upstream.terminate()
    })
  })
  upstream.once('error', (err) => {
    if (settled) return
    settled = true
    socket.off('close', onSocketClose)
    reject(502, `Upstream unreachable: ${errorMessage(err)}`, 'upstream_unreachable')
  })
}
