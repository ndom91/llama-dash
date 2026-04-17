import type { IncomingMessage, ServerResponse } from 'node:http'

export async function handleAdminRequest(
  _req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  res.statusCode = 404
  res.setHeader('content-type', 'application/json')
  res.end(JSON.stringify({ error: 'not found' }))
}
