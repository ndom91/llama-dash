import { eq } from 'drizzle-orm'
import { db, schema } from '../db/index.ts'

type RequestLimits = {
  maxMessages: number | null
  maxEstimatedTokens: number | null
}

type BodyLogLimits = {
  maxBytes: number
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

let _limitsCache: RequestLimits | null = null
let _bodyLimitsCache: BodyLogLimits | null = null
let _attributionCache: AttributionSettings | null = null

function invalidateCache() {
  _limitsCache = null
  _bodyLimitsCache = null
  _attributionCache = null
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
  const raw = getSetting('max_logged_body_bytes')
  const parsed = raw != null ? Number(raw) : Number.NaN
  _bodyLimitsCache = {
    maxBytes: Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_LOGGED_BODY_BYTES,
  }
  return _bodyLimitsCache
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
