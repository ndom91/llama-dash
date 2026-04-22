import { createHash, randomBytes } from 'node:crypto'
import { and, desc, eq } from 'drizzle-orm'
import { ulid } from 'ulidx'
import type { ApiKeyItem } from '../../lib/schemas/api-key.ts'
import { db, schema } from '../db/index.ts'

export function listApiKeys(): Array<ApiKeyItem> {
  const rows = db
    .select()
    .from(schema.apiKeys)
    .where(eq(schema.apiKeys.system, false))
    .orderBy(desc(schema.apiKeys.createdAt))
    .all()

  return rows.map(toApiShape)
}

export function getApiKeyById(id: string): ApiKeyItem | null {
  const row = db
    .select()
    .from(schema.apiKeys)
    .where(and(eq(schema.apiKeys.id, id), eq(schema.apiKeys.system, false)))
    .get()
  return row ? toApiShape(row) : null
}

export function createApiKey(input: {
  name: string
  allowedModels?: Array<string>
  rateLimitRpm?: number | null
  rateLimitTpm?: number | null
  monthlyTokenQuota?: number | null
  systemPrompt?: string | null
}): { key: ApiKeyItem; rawKey: string } {
  const rawKey = `sk-${randomBytes(32).toString('hex')}`
  const keyHash = createHash('sha256').update(rawKey).digest('hex')
  const keyPrefix = rawKey.slice(0, 8)
  const id = `key_${ulid()}`
  const now = new Date()

  const row = {
    id,
    name: input.name,
    keyHash,
    keyPrefix,
    createdAt: now,
    disabledAt: null,
    allowedModels: JSON.stringify(input.allowedModels ?? []),
    rateLimitRpm: input.rateLimitRpm ?? null,
    rateLimitTpm: input.rateLimitTpm ?? null,
    monthlyTokenQuota: input.monthlyTokenQuota ?? null,
    defaultModel: null,
    systemPrompt: input.systemPrompt ?? null,
    system: false,
  }

  db.insert(schema.apiKeys).values(row).run()
  invalidateKeyCache()

  return { key: toApiShape({ ...row, createdAt: now, disabledAt: null }), rawKey }
}

export function renameApiKey(id: string, name: string): boolean {
  const result = db.update(schema.apiKeys).set({ name }).where(eq(schema.apiKeys.id, id)).run()
  return result.changes > 0
}

export function updateApiKey(
  id: string,
  fields: {
    name?: string
    allowedModels?: Array<string>
    systemPrompt?: string | null
  },
): boolean {
  const set: Record<string, unknown> = {}
  if (fields.name != null) set.name = fields.name
  if (fields.allowedModels != null) set.allowedModels = JSON.stringify(fields.allowedModels)
  if (fields.systemPrompt !== undefined) set.systemPrompt = fields.systemPrompt
  if (Object.keys(set).length === 0) return false
  const result = db.update(schema.apiKeys).set(set).where(eq(schema.apiKeys.id, id)).run()
  invalidateKeyCache()
  return result.changes > 0
}

export function revokeApiKey(id: string): boolean {
  const result = db.update(schema.apiKeys).set({ disabledAt: new Date() }).where(eq(schema.apiKeys.id, id)).run()

  invalidateKeyCache()
  return result.changes > 0
}

export function deleteApiKey(id: string): boolean {
  const result = db.delete(schema.apiKeys).where(eq(schema.apiKeys.id, id)).run()
  invalidateKeyCache()
  return result.changes > 0
}

export function findKeyByHash(hash: string): schema.ApiKey | undefined {
  return db.select().from(schema.apiKeys).where(eq(schema.apiKeys.keyHash, hash)).get()
}

let _hasUserKeysCache: boolean | null = null

export function hasAnyUserKeys(): boolean {
  if (_hasUserKeysCache != null) return _hasUserKeysCache
  const row = db
    .select({ id: schema.apiKeys.id })
    .from(schema.apiKeys)
    .where(eq(schema.apiKeys.system, false))
    .limit(1)
    .get()
  _hasUserKeysCache = row != null
  return _hasUserKeysCache
}

export function invalidateKeyCache() {
  _hasUserKeysCache = null
}

let _systemRawKey: string | null = null

export function ensureSystemKey(): void {
  const existing = db
    .select({ id: schema.apiKeys.id, keyHash: schema.apiKeys.keyHash })
    .from(schema.apiKeys)
    .where(eq(schema.apiKeys.system, true))
    .get()

  if (existing) {
    _systemRawKey = null
    return
  }

  const rawKey = `sk-sys-${randomBytes(32).toString('hex')}`
  const keyHash = createHash('sha256').update(rawKey).digest('hex')
  const id = `key_${ulid()}`

  db.insert(schema.apiKeys)
    .values({
      id,
      name: 'Playground (system)',
      keyHash,
      keyPrefix: rawKey.slice(0, 10),
      createdAt: new Date(),
      disabledAt: null,
      allowedModels: '[]',
      rateLimitRpm: null,
      rateLimitTpm: null,
      monthlyTokenQuota: null,
      system: true,
    })
    .run()

  _systemRawKey = rawKey
}

export function getSystemKeyRaw(): string | null {
  if (_systemRawKey) return _systemRawKey

  const row = db
    .select({ keyHash: schema.apiKeys.keyHash })
    .from(schema.apiKeys)
    .where(eq(schema.apiKeys.system, true))
    .get()

  if (!row) return null

  // Can't reverse hash — if key existed before this boot, we need to regenerate
  const rawKey = `sk-sys-${randomBytes(32).toString('hex')}`
  const keyHash = createHash('sha256').update(rawKey).digest('hex')

  db.update(schema.apiKeys)
    .set({ keyHash, keyPrefix: rawKey.slice(0, 10) })
    .where(eq(schema.apiKeys.system, true))
    .run()

  _systemRawKey = rawKey
  return _systemRawKey
}

function toApiShape(row: schema.ApiKey): ApiKeyItem {
  return {
    id: row.id,
    name: row.name,
    keyPrefix: row.keyPrefix,
    createdAt: row.createdAt.toISOString(),
    disabledAt: row.disabledAt?.toISOString() ?? null,
    allowedModels: JSON.parse(row.allowedModels),
    rateLimitRpm: row.rateLimitRpm,
    rateLimitTpm: row.rateLimitTpm,
    monthlyTokenQuota: row.monthlyTokenQuota,
    systemPrompt: row.systemPrompt,
  }
}
