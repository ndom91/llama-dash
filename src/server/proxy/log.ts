import { ulid } from 'ulidx'
import { db, schema } from '../db/index.ts'

export type RequestLogInput = {
  startedAt: number
  durationMs: number
  method: string
  endpoint: string
  model: string | null
  statusCode: number
  promptTokens: number | null
  completionTokens: number | null
  totalTokens: number | null
  streamed: boolean
  error: string | null
  requestHeaders: string | null
  requestBody: string | null
  responseHeaders: string | null
  responseBody: string | null
  streamCloseMs: number | null
  keyId: string | null
}

export function writeRequestLog(row: RequestLogInput) {
  db.insert(schema.requests)
    .values({
      id: `req_${ulid()}`,
      startedAt: new Date(row.startedAt),
      durationMs: row.durationMs,
      method: row.method,
      endpoint: row.endpoint,
      model: row.model,
      statusCode: row.statusCode,
      promptTokens: row.promptTokens,
      completionTokens: row.completionTokens,
      totalTokens: row.totalTokens,
      streamed: row.streamed,
      error: row.error,
      requestHeaders: row.requestHeaders,
      requestBody: row.requestBody,
      responseHeaders: row.responseHeaders,
      responseBody: row.responseBody,
      streamCloseMs: row.streamCloseMs,
      keyId: row.keyId,
    })
    .run()
}
