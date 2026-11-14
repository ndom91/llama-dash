import type { IncomingMessage } from 'node:http'
import type { Duplex } from 'node:stream'
import { errorMessage } from '../error-message.ts'
import { handleRealtimeUpgrade } from './realtime.ts'
import { writeHttpError } from './ws-common.ts'
import { handleWsPassthroughUpgrade } from './ws-passthrough.ts'

/** Paths whose WebSocket upgrades the proxy accepts. Keep in sync with vite.config.ts. */
export function isProxyUpgradePath(pathname: string): boolean {
  return pathname === '/v1/realtime' || pathname.startsWith('/comfyui/')
}

/**
 * Routes a Node `upgrade` event to the right WebSocket proxy. Returns false
 * for every other path so other upgrade consumers (Vite HMR) keep working.
 */
export function handleProxyUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer): boolean {
  const pathname = new URL(req.url ?? '/', 'http://localhost').pathname
  if (!isProxyUpgradePath(pathname)) return false
  if (pathname === '/v1/realtime') return handleRealtimeUpgrade(req, socket, head)
  socket.on('error', () => {})
  try {
    handleWsPassthroughUpgrade(req, socket, head)
  } catch (err) {
    console.error('[ws-passthrough] upgrade failed', err)
    writeHttpError(socket, 500, { message: errorMessage(err), type: 'internal_error' })
  }
  return true
}
