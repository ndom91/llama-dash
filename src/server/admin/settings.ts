import { eq } from 'drizzle-orm'
import { db, schema } from '../db/index.ts'

type RequestLimits = {
  maxMessages: number | null
  maxEstimatedTokens: number | null
}

let _limitsCache: RequestLimits | null = null

function invalidateCache() {
  _limitsCache = null
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
