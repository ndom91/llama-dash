import { ulid } from 'ulidx'
import { getApiKeyName } from '../admin/api-keys.ts'
import { publishAdminEvent } from '../admin/events.ts'
import { getPrivacySettings } from '../admin/settings.ts'
import { toRequestRow } from '../admin/requests.ts'
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
  requestClass: 'inference' | 'mcp_relay'
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
  routingTargetCredentialId: string | null
  routingRequestedModel: string | null
  routingRoutedModel: string | null
  routingRejectReason: string | null
  credentialInjectionJson?: string | null
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
  const privacy = getPrivacySettings()
  const isSuccessfulMcpRelay = row.requestClass === 'mcp_relay' && row.statusCode < 400 && row.error == null
  const persistBodies = !isSuccessfulMcpRelay || privacy.mcpRelayPersistSuccessBodies
  // Keep full bodies in-memory for recent-debug access; DB keeps truncated.
  if (persistBodies && maxBytes > 0)
    storeRecentBodies(id, { requestBody: row.requestBody, responseBody: row.responseBody })
  const requestBody = persistBodies ? truncateBody(row.requestBody, maxBytes) : null
  const responseBody = persistBodies ? truncateBody(row.responseBody, maxBytes) : null
  const requestHeaders = persistBodies ? row.requestHeaders : null
  const responseHeaders = persistBodies ? row.responseHeaders : null
  const costUsd = computeCostUsd(row.model, row)
  db.insert(schema.requests)
    .values({
      id,
      startedAt: new Date(row.startedAt),
      durationMs: row.durationMs,
      requestClass: row.requestClass,
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
      requestHeaders,
      requestBody,
      responseHeaders,
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
      routingTargetCredentialId: row.routingTargetCredentialId,
      routingRequestedModel: row.routingRequestedModel,
      routingRoutedModel: row.routingRoutedModel,
      routingRejectReason: row.routingRejectReason,
      credentialInjectionJson: row.credentialInjectionJson ?? null,
    })
    .run()
  publishAdminEvent('request.completed', {
    request: toRequestRow(
      {
        id,
        startedAt: new Date(row.startedAt),
        durationMs: row.durationMs,
        requestClass: row.requestClass,
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
        clientHost: row.clientHost,
        clientName: row.clientName,
        endUserId: row.endUserId,
        sessionId: row.sessionId,
        routingRuleName: row.routingRuleName,
        routingActionType: row.routingActionType,
        routingAuthMode: row.routingAuthMode,
        routingPreserveAuthorization: row.routingPreserveAuthorization,
        routingTargetType: row.routingTargetType,
        routingTargetBaseUrl: row.routingTargetBaseUrl,
        routingTargetCredentialId: row.routingTargetCredentialId,
        routingRoutedModel: row.routingRoutedModel,
        credentialInjectionJson: row.credentialInjectionJson ?? null,
      },
      row.keyId ? getApiKeyName(row.keyId) : null,
    ),
  })
}
