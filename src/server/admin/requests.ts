import { and, desc, eq, lt } from 'drizzle-orm'
import { db, schema } from '../db/index.ts'

export type RequestRow = {
  id: string
  startedAt: string
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

export type RequestDetail = RequestRow & {
  requestHeaders: string | null
  requestBody: string | null
  responseHeaders: string | null
  responseBody: string | null
}

export function listRecentRequests(opts: { limit: number; cursor?: string }): Array<RequestRow> {
  const where = opts.cursor != null ? lt(schema.requests.id, opts.cursor) : undefined
  const rows = db
    .select()
    .from(schema.requests)
    .where(and(where))
    .orderBy(desc(schema.requests.id))
    .limit(opts.limit)
    .all()
  return rows.map((r) => ({
    id: r.id,
    startedAt: r.startedAt.toISOString(),
    durationMs: r.durationMs,
    method: r.method,
    endpoint: r.endpoint,
    model: r.model,
    statusCode: r.statusCode,
    promptTokens: r.promptTokens,
    completionTokens: r.completionTokens,
    totalTokens: r.totalTokens,
    streamed: r.streamed,
    error: r.error,
  }))
}

export function getRequestById(id: string): RequestDetail | null {
  const r = db.select().from(schema.requests).where(eq(schema.requests.id, id)).get()
  if (!r) return null
  return {
    id: r.id,
    startedAt: r.startedAt.toISOString(),
    durationMs: r.durationMs,
    method: r.method,
    endpoint: r.endpoint,
    model: r.model,
    statusCode: r.statusCode,
    promptTokens: r.promptTokens,
    completionTokens: r.completionTokens,
    totalTokens: r.totalTokens,
    streamed: r.streamed,
    error: r.error,
    requestHeaders: r.requestHeaders,
    requestBody: r.requestBody,
    responseHeaders: r.responseHeaders,
    responseBody: r.responseBody,
  }
}
