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
}

export function writeRequestLog(row: RequestLogInput) {
  db.insert(schema.requests)
    .values({
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
    })
    .run()
}
