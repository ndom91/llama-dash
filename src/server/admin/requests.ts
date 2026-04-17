import { and, asc, desc, eq, gt, lt } from 'drizzle-orm'
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

export function getAdjacentIds(id: string): { prevId: string | null; nextId: string | null } {
  const prev = db
    .select({ id: schema.requests.id })
    .from(schema.requests)
    .where(gt(schema.requests.id, id))
    .orderBy(asc(schema.requests.id))
    .limit(1)
    .get()
  const next = db
    .select({ id: schema.requests.id })
    .from(schema.requests)
    .where(lt(schema.requests.id, id))
    .orderBy(desc(schema.requests.id))
    .limit(1)
    .get()
  return { prevId: prev?.id ?? null, nextId: next?.id ?? null }
}
