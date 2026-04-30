import { ulid } from 'ulidx'
import { getBodyLogLimits } from '../admin/settings.ts'
import { db, schema } from '../db/index.ts'
import { computeCostUsd } from '../pricing.ts'
import { storeRecentBodies } from './recent-bodies.ts'

const MAX_LOG_QUEUE_SIZE = 1_000
const LOG_FLUSH_INTERVAL_MS = 25

let queue: RequestLogInput[] = []
let flushScheduled = false
let droppedLogs = 0

function truncateBody(body: string | null, maxBytes: number): string | null {
  if (body == null) return null
  if (maxBytes <= 0) return null
  const fullBytes = Buffer.byteLength(body, 'utf8')
  if (fullBytes <= maxBytes) return body
  // Reserve room for the marker. Slice by code units (cheap) and trim any
  // trailing partial UTF-8 sequence by re-measuring; SQLite stores UTF-8.
  const MARKER_RESERVE = 128
  let cut = body.slice(0, Math.max(0, maxBytes - MARKER_RESERVE))
  while (Buffer.byteLength(cut, 'utf8') > maxBytes - MARKER_RESERVE) {
    cut = cut.slice(0, -1)
  }
  return `${cut}\n...[truncated ${fullBytes - Buffer.byteLength(cut, 'utf8')} bytes]`
}

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
  cacheCreationTokens: number | null
  cacheReadTokens: number | null
  streamed: boolean
  error: string | null
  requestHeaders: string | null
  requestBody: string | null
  responseHeaders: string | null
  responseBody: string | null
  streamCloseMs: number | null
  keyId: string | null
  clientHost: string | null
  clientName: string | null
  endUserId: string | null
  sessionId: string | null
  routingRuleId: string | null
  routingRuleName: string | null
  routingActionType: string | null
  routingAuthMode: string | null
  routingPreserveAuthorization: boolean
  routingTargetType: string | null
  routingTargetBaseUrl: string | null
  routingRequestedModel: string | null
  routingRoutedModel: string | null
  routingRejectReason: string | null
}

export function writeRequestLog(row: RequestLogInput) {
  if (queue.length >= MAX_LOG_QUEUE_SIZE) {
    droppedLogs++
    return
  }
  queue.push(row)
  scheduleFlush()
}

export function getRequestLogQueueStats(): { queued: number; dropped: number } {
  return { queued: queue.length, dropped: droppedLogs }
}

export function resetRequestLogQueueForTest() {
  queue = []
  flushScheduled = false
  droppedLogs = 0
}

export function flushRequestLogQueue() {
  flushScheduled = false
  const rows = queue
  queue = []
  for (const row of rows) {
    try {
      writeRequestLogNow(row)
    } catch (err) {
      droppedLogs++
      console.warn('Failed to write request log', err)
    }
  }
}

function scheduleFlush() {
  if (flushScheduled) return
  flushScheduled = true
  setTimeout(flushRequestLogQueue, LOG_FLUSH_INTERVAL_MS).unref?.()
}

export function writeRequestLogNow(row: RequestLogInput) {
  const id = `req_${ulid()}`
  const { maxBytes } = getBodyLogLimits()
  // Keep full bodies in-memory for recent-debug access; DB keeps truncated.
  if (maxBytes > 0) storeRecentBodies(id, { requestBody: row.requestBody, responseBody: row.responseBody })
  const requestBody = truncateBody(row.requestBody, maxBytes)
  const responseBody = truncateBody(row.responseBody, maxBytes)
  const costUsd = computeCostUsd(row.model, row)
  db.insert(schema.requests)
    .values({
      id,
      startedAt: new Date(row.startedAt),
      durationMs: row.durationMs,
      method: row.method,
      endpoint: row.endpoint,
      model: row.model,
      statusCode: row.statusCode,
      promptTokens: row.promptTokens,
      completionTokens: row.completionTokens,
      totalTokens: row.totalTokens,
      cacheCreationTokens: row.cacheCreationTokens,
      cacheReadTokens: row.cacheReadTokens,
      costUsd,
      streamed: row.streamed,
      error: row.error,
      requestHeaders: row.requestHeaders,
      requestBody,
      responseHeaders: row.responseHeaders,
      responseBody,
      streamCloseMs: row.streamCloseMs,
      keyId: row.keyId,
      clientHost: row.clientHost,
      clientName: row.clientName,
      endUserId: row.endUserId,
      sessionId: row.sessionId,
      routingRuleId: row.routingRuleId,
      routingRuleName: row.routingRuleName,
      routingActionType: row.routingActionType,
      routingAuthMode: row.routingAuthMode,
      routingPreserveAuthorization: row.routingPreserveAuthorization,
      routingTargetType: row.routingTargetType,
      routingTargetBaseUrl: row.routingTargetBaseUrl,
      routingRequestedModel: row.routingRequestedModel,
      routingRoutedModel: row.routingRoutedModel,
      routingRejectReason: row.routingRejectReason,
    })
    .run()
}
