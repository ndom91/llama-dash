import { flushLogs } from './db.ts'

/** Drain the proxy response body so forward.ts writes its completion log, then flush SQLite. */
export async function settleProxyResponse(response: Response): Promise<Response> {
  if (response.body) {
    await response.arrayBuffer()
  }
  flushLogs()
  return response
}
