import { createHash, randomBytes } from 'node:crypto'
import { desc, eq } from 'drizzle-orm'
import { ulid } from 'ulidx'
import type { ApiKeyItem } from '../../lib/schemas/api-key.ts'
import { db, schema } from '../db/index.ts'

export function listApiKeys(): Array<ApiKeyItem> {
  const rows = db.select().from(schema.apiKeys).orderBy(desc(schema.apiKeys.createdAt)).all()

  return rows.map(toApiShape)
}

export function createApiKey(input: {
  name: string
  allowedModels?: Array<string>
  rateLimitRpm?: number | null
  rateLimitTpm?: number | null
  monthlyTokenQuota?: number | null
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
  }

  db.insert(schema.apiKeys).values(row).run()
  invalidateKeyCache()

  return { key: toApiShape({ ...row, createdAt: now, disabledAt: null }), rawKey }
}

export function renameApiKey(id: string, name: string): boolean {
  const result = db.update(schema.apiKeys).set({ name }).where(eq(schema.apiKeys.id, id)).run()
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

let _hasKeysCache: boolean | null = null

export function hasAnyKeys(): boolean {
  if (_hasKeysCache != null) return _hasKeysCache
  const row = db.select({ id: schema.apiKeys.id }).from(schema.apiKeys).limit(1).get()
  _hasKeysCache = row != null
  return _hasKeysCache
}

export function invalidateKeyCache() {
  _hasKeysCache = null
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
  }
}
