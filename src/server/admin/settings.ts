import { eq } from 'drizzle-orm'
import { db, schema } from '../db/index.ts'

type RequestLimits = {
  maxMessages: number | null
  maxEstimatedTokens: number | null
}

type BodyLogLimits = {
  maxBytes: number
}

type PrivacySettings = {
  captureRequestBodies: boolean
  captureResponseBodies: boolean
  maxStoredBodyBytes: number
  mcpRelayPersistSuccessBodies: boolean
  requestLogRetentionDays: number
  mcpRelaySuccessRetentionDays: number
  mcpRelayErrorRetentionDays: number
  bodyRetentionDays: number
}

type AttributionSettings = {
  clientNameHeader: string | null
  endUserIdHeader: string | null
  sessionIdHeader: string | null
}

// Claude Code requests are 50-100KB each — storing every body verbatim makes
// `data/dash.db` balloon fast. Truncate at this threshold by default; the
// in-memory ring (recent-bodies.ts) keeps the full payload for live debugging.
const DEFAULT_MAX_LOGGED_BODY_BYTES = 32 * 1024
const DEFAULT_REQUEST_LOG_RETENTION_DAYS = 30
const DEFAULT_MCP_RELAY_SUCCESS_RETENTION_DAYS = 7
const DEFAULT_MCP_RELAY_ERROR_RETENTION_DAYS = 30
const DEFAULT_BODY_RETENTION_DAYS = 3

let _limitsCache: RequestLimits | null = null
let _bodyLimitsCache: BodyLogLimits | null = null
let _privacyCache: PrivacySettings | null = null
let _attributionCache: AttributionSettings | null = null

function invalidateCache() {
  _limitsCache = null
  _bodyLimitsCache = null
  _privacyCache = null
  _attributionCache = null
}

function parseBooleanSetting(value: string | null, fallback: boolean): boolean {
  if (value === 'true') return true
  if (value === 'false') return false
  return fallback
}

function parsePositiveIntegerSetting(value: string | null, fallback: number): number {
  const parsed = value != null ? Number(value) : Number.NaN
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

function getSetting(key: string): string | null {
  const row = db.select().from(schema.settings).where(eq(schema.settings.key, key)).get()
  return row?.value ?? null
}

function setSetting(key: string, value: string | null) {
  if (value == null) {
    db.delete(schema.settings).where(eq(schema.settings.key, key)).run()
  } else {
    db.insert(schema.settings)
      .values({ key, value, updatedAt: new Date() })
      .onConflictDoUpdate({ target: schema.settings.key, set: { value, updatedAt: new Date() } })
      .run()
  }
  invalidateCache()
}

export function getRequestLimits(): RequestLimits {
  if (_limitsCache) return _limitsCache
  const maxMsg = getSetting('max_messages_per_request')
  const maxTok = getSetting('max_estimated_prompt_tokens')
  _limitsCache = {
    maxMessages: maxMsg != null ? Number(maxMsg) : null,
    maxEstimatedTokens: maxTok != null ? Number(maxTok) : null,
  }
  return _limitsCache
}

export function getBodyLogLimits(): BodyLogLimits {
  if (_bodyLimitsCache) return _bodyLimitsCache
  const { maxStoredBodyBytes } = getPrivacySettings()
  _bodyLimitsCache = {
    maxBytes: maxStoredBodyBytes,
  }
  return _bodyLimitsCache
}

export function getPrivacySettings(): PrivacySettings {
  if (_privacyCache) return _privacyCache
  const rawMaxBytes = getSetting('max_logged_body_bytes')
  const parsedMaxBytes = rawMaxBytes != null ? Number(rawMaxBytes) : Number.NaN
  _privacyCache = {
    captureRequestBodies: parseBooleanSetting(getSetting('capture_request_bodies'), true),
    captureResponseBodies: parseBooleanSetting(getSetting('capture_response_bodies'), true),
    maxStoredBodyBytes:
      Number.isFinite(parsedMaxBytes) && parsedMaxBytes >= 0 ? parsedMaxBytes : DEFAULT_MAX_LOGGED_BODY_BYTES,
    mcpRelayPersistSuccessBodies: parseBooleanSetting(getSetting('mcp_relay_persist_success_bodies'), false),
    requestLogRetentionDays: parsePositiveIntegerSetting(
      getSetting('request_log_retention_days'),
      DEFAULT_REQUEST_LOG_RETENTION_DAYS,
    ),
    mcpRelaySuccessRetentionDays: parsePositiveIntegerSetting(
      getSetting('mcp_relay_success_retention_days'),
      DEFAULT_MCP_RELAY_SUCCESS_RETENTION_DAYS,
    ),
    mcpRelayErrorRetentionDays: parsePositiveIntegerSetting(
      getSetting('mcp_relay_error_retention_days'),
      DEFAULT_MCP_RELAY_ERROR_RETENTION_DAYS,
    ),
    bodyRetentionDays: parsePositiveIntegerSetting(getSetting('body_retention_days'), DEFAULT_BODY_RETENTION_DAYS),
  }
  return _privacyCache
}

export function getAttributionSettings(): AttributionSettings {
  if (_attributionCache) return _attributionCache
  _attributionCache = {
    clientNameHeader: getSetting('attribution_client_name_header'),
    endUserIdHeader: getSetting('attribution_end_user_id_header'),
    sessionIdHeader: getSetting('attribution_session_id_header'),
  }
  return _attributionCache
}

export function setRequestLimits(limits: { maxMessages?: number | null; maxEstimatedTokens?: number | null }) {
  if (limits.maxMessages !== undefined) {
    setSetting('max_messages_per_request', limits.maxMessages != null ? String(limits.maxMessages) : null)
  }
  if (limits.maxEstimatedTokens !== undefined) {
    setSetting(
      'max_estimated_prompt_tokens',
      limits.maxEstimatedTokens != null ? String(limits.maxEstimatedTokens) : null,
    )
  }
}

export function setAttributionSettings(settings: {
  clientNameHeader?: string | null
  endUserIdHeader?: string | null
  sessionIdHeader?: string | null
}) {
  if (settings.clientNameHeader !== undefined) {
    setSetting('attribution_client_name_header', settings.clientNameHeader)
  }
  if (settings.endUserIdHeader !== undefined) {
    setSetting('attribution_end_user_id_header', settings.endUserIdHeader)
  }
  if (settings.sessionIdHeader !== undefined) {
    setSetting('attribution_session_id_header', settings.sessionIdHeader)
  }
}

export function setPrivacySettings(settings: {
  captureRequestBodies?: boolean
  captureResponseBodies?: boolean
  maxStoredBodyBytes?: number
  mcpRelayPersistSuccessBodies?: boolean
  requestLogRetentionDays?: number
  mcpRelaySuccessRetentionDays?: number
  mcpRelayErrorRetentionDays?: number
  bodyRetentionDays?: number
}) {
  if (settings.captureRequestBodies !== undefined) {
    setSetting('capture_request_bodies', String(settings.captureRequestBodies))
  }
  if (settings.captureResponseBodies !== undefined) {
    setSetting('capture_response_bodies', String(settings.captureResponseBodies))
  }
  if (settings.maxStoredBodyBytes !== undefined) {
    setSetting('max_logged_body_bytes', String(settings.maxStoredBodyBytes))
  }
  if (settings.mcpRelayPersistSuccessBodies !== undefined) {
    setSetting('mcp_relay_persist_success_bodies', String(settings.mcpRelayPersistSuccessBodies))
  }
  if (settings.requestLogRetentionDays !== undefined) {
    setSetting('request_log_retention_days', String(settings.requestLogRetentionDays))
  }
  if (settings.mcpRelaySuccessRetentionDays !== undefined) {
    setSetting('mcp_relay_success_retention_days', String(settings.mcpRelaySuccessRetentionDays))
  }
  if (settings.mcpRelayErrorRetentionDays !== undefined) {
    setSetting('mcp_relay_error_retention_days', String(settings.mcpRelayErrorRetentionDays))
  }
  if (settings.bodyRetentionDays !== undefined) {
    setSetting('body_retention_days', String(settings.bodyRetentionDays))
  }
}
