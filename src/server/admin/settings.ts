import { eq } from 'drizzle-orm'
import { parseUsagePanelsSetting, type UsagePanelSettings } from '../../lib/schemas/usage.ts'
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
let _privacyCache: PrivacySettings | null = null
let _attributionCache: AttributionSettings | null = null
let _usagePanelsCache: UsagePanelSettings | null = null

function invalidateCache() {
  _limitsCache = null
  _privacyCache = null
  _attributionCache = null
  _usagePanelsCache = null
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
  return { maxBytes: getPrivacySettings().maxStoredBodyBytes }
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
    requestLogRetentionDays: Math.max(
      2,
      parsePositiveIntegerSetting(getSetting('request_log_retention_days'), DEFAULT_REQUEST_LOG_RETENTION_DAYS),
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

const ATTRIBUTION_SETTING_KEYS = {
  clientNameHeader: 'attribution_client_name_header',
  endUserIdHeader: 'attribution_end_user_id_header',
  sessionIdHeader: 'attribution_session_id_header',
} as const satisfies Record<keyof AttributionSettings, string>

export function setAttributionSettings(settings: Partial<AttributionSettings>) {
  for (const [field, key] of Object.entries(ATTRIBUTION_SETTING_KEYS) as Array<[keyof AttributionSettings, string]>) {
    const value = settings[field]
    if (value !== undefined) setSetting(key, value)
  }
}

const PRIVACY_SETTING_KEYS = {
  captureRequestBodies: 'capture_request_bodies',
  captureResponseBodies: 'capture_response_bodies',
  maxStoredBodyBytes: 'max_logged_body_bytes',
  mcpRelayPersistSuccessBodies: 'mcp_relay_persist_success_bodies',
  requestLogRetentionDays: 'request_log_retention_days',
  mcpRelaySuccessRetentionDays: 'mcp_relay_success_retention_days',
  mcpRelayErrorRetentionDays: 'mcp_relay_error_retention_days',
  bodyRetentionDays: 'body_retention_days',
} as const satisfies Record<keyof PrivacySettings, string>

export function setPrivacySettings(settings: Partial<PrivacySettings>) {
  for (const [field, key] of Object.entries(PRIVACY_SETTING_KEYS) as Array<[keyof PrivacySettings, string]>) {
    const value = settings[field]
    if (value !== undefined) setSetting(key, String(value))
  }
}

/** Which breakdown each Usage page panel shows; missing or invalid → defaults. */
export function getUsagePanelSettings(): UsagePanelSettings {
  if (_usagePanelsCache) return _usagePanelsCache
  _usagePanelsCache = { panels: parseUsagePanelsSetting(getSetting('usage_panels')) }
  return _usagePanelsCache
}

export function setUsagePanelSettings(settings: UsagePanelSettings) {
  setSetting('usage_panels', JSON.stringify(settings.panels))
}
