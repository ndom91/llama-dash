import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import { desc, eq } from 'drizzle-orm'
import { ulid } from 'ulidx'
import * as v from 'valibot'
import type {
  CreateUpstreamCredentialBody,
  UpdateUpstreamCredentialBody,
  UpstreamCredential,
} from '../../lib/schemas/upstream-credential.ts'
import { db, schema } from '../db/index.ts'
import { config } from '../config.ts'

type EncryptedPayload = {
  v: 1
  alg: 'aes-256-gcm'
  iv: string
  tag: string
  data: string
}

const EncryptedPayloadSchema = v.object({
  v: v.literal(1),
  alg: v.literal('aes-256-gcm'),
  iv: v.pipe(v.string(), v.minLength(1)),
  tag: v.pipe(v.string(), v.minLength(1)),
  data: v.pipe(v.string(), v.minLength(1)),
})

export function isCredentialVaultEnabled(): boolean {
  return isCredentialVaultKeyEnabled(getCredentialEncryptionKey())
}

export function isCredentialVaultKeyEnabled(key: string): boolean {
  return key.length >= 32
}

function getCredentialEncryptionKey(): string {
  return config.credentialEncryptionKey
}

export function getCredentialVaultStatus(
  key = getCredentialEncryptionKey(),
): 'ready' | 'missing_key' | 'key_too_short' {
  if (!key) return 'missing_key'
  if (!isCredentialVaultKeyEnabled(key)) return 'key_too_short'
  return 'ready'
}

function requireVaultKey(key = getCredentialEncryptionKey()): Buffer {
  if (!isCredentialVaultKeyEnabled(key)) {
    const detail = getCredentialVaultStatus(key) === 'missing_key' ? 'is not set' : 'must be at least 32 characters'
    throw new Error(`CREDENTIAL_ENCRYPTION_KEY ${detail} before using upstream credentials`)
  }
  return createHash('sha256').update(key).digest()
}

function encryptSecret(value: string, encryptionKey?: string): string {
  const key = requireVaultKey(encryptionKey)
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const data = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  const payload: EncryptedPayload = {
    v: 1,
    alg: 'aes-256-gcm',
    iv: iv.toString('base64url'),
    tag: cipher.getAuthTag().toString('base64url'),
    data: data.toString('base64url'),
  }
  return JSON.stringify(payload)
}

function decryptSecret(raw: string, encryptionKey?: string): string {
  const key = requireVaultKey(encryptionKey)
  const payload = parseEncryptedPayload(raw)
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(payload.iv, 'base64url'))
  decipher.setAuthTag(Buffer.from(payload.tag, 'base64url'))
  return Buffer.concat([decipher.update(Buffer.from(payload.data, 'base64url')), decipher.final()]).toString('utf8')
}

function parseEncryptedPayload(raw: string): EncryptedPayload {
  try {
    return v.parse(EncryptedPayloadSchema, JSON.parse(raw))
  } catch {
    throw new Error('Invalid credential payload')
  }
}

function toApiShape(row: schema.UpstreamCredential): UpstreamCredential {
  const slug = ensureValidSlug(row)
  return {
    id: row.id,
    name: row.name,
    slug,
    type: row.type,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
  }
}

function slugFromName(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72)
  return slug || 'credential'
}

function isValidSlug(slug: string): boolean {
  return /^[a-z0-9][a-z0-9_-]{1,80}$/.test(slug)
}

function uniqueSlug(base: string, id: string, currentId?: string): string {
  const existing = db.select().from(schema.upstreamCredentials).where(eq(schema.upstreamCredentials.slug, base)).get()
  if (!existing || existing.id === currentId) return base
  return `${base.slice(0, 72)}-${id.slice(-6).toLowerCase()}`
}

function ensureValidSlug(row: schema.UpstreamCredential): string {
  if (isValidSlug(row.slug)) return row.slug
  const slug = uniqueSlug(slugFromName(row.name), row.id, row.id)
  db.update(schema.upstreamCredentials)
    .set({ slug, updatedAt: new Date() })
    .where(eq(schema.upstreamCredentials.id, row.id))
    .run()
  return slug
}

export function listUpstreamCredentials(): UpstreamCredential[] {
  return db
    .select()
    .from(schema.upstreamCredentials)
    .orderBy(desc(schema.upstreamCredentials.createdAt))
    .all()
    .map(toApiShape)
}

export function createUpstreamCredential(
  input: CreateUpstreamCredentialBody,
  encryptionKey?: string,
): UpstreamCredential {
  const id = `ucr_${ulid()}`
  const now = new Date()
  const slug = input.slug ?? uniqueSlug(slugFromName(input.name), id)
  db.insert(schema.upstreamCredentials)
    .values({
      id,
      name: input.name,
      slug,
      type: input.type,
      encryptedValue: encryptSecret(input.value, encryptionKey),
      createdAt: now,
      updatedAt: now,
    })
    .run()
  return toApiShape(db.select().from(schema.upstreamCredentials).where(eq(schema.upstreamCredentials.id, id)).get()!)
}

export function updateUpstreamCredential(
  id: string,
  input: UpdateUpstreamCredentialBody,
  encryptionKey?: string,
): UpstreamCredential | null {
  const set: Partial<schema.NewUpstreamCredential> = { updatedAt: new Date() }
  if (input.name !== undefined) set.name = input.name
  if (input.slug !== undefined) set.slug = input.slug
  if (input.value !== undefined) set.encryptedValue = encryptSecret(input.value, encryptionKey)
  const result = db.update(schema.upstreamCredentials).set(set).where(eq(schema.upstreamCredentials.id, id)).run()
  if (result.changes === 0) return null
  const row = db.select().from(schema.upstreamCredentials).where(eq(schema.upstreamCredentials.id, id)).get()
  return row ? toApiShape(row) : null
}

export function deleteUpstreamCredential(id: string): boolean {
  return db.delete(schema.upstreamCredentials).where(eq(schema.upstreamCredentials.id, id)).run().changes > 0
}

export function getCredentialAuthorizationHeader(id: string, encryptionKey?: string): string | null {
  const row = db.select().from(schema.upstreamCredentials).where(eq(schema.upstreamCredentials.id, id)).get()
  if (!row) return null
  db.update(schema.upstreamCredentials)
    .set({ lastUsedAt: new Date() })
    .where(eq(schema.upstreamCredentials.id, id))
    .run()
  if (row.type === 'bearer') return `Bearer ${decryptSecret(row.encryptedValue, encryptionKey)}`
  return null
}

export type CredentialInjectionSecret = {
  id: string
  name: string
  slug: string
  type: 'bearer'
  value: string
}

export function getCredentialInjectionSecret(id: string, encryptionKey?: string): CredentialInjectionSecret | null {
  const row = db.select().from(schema.upstreamCredentials).where(eq(schema.upstreamCredentials.id, id)).get()
  if (!row) return null
  const slug = ensureValidSlug(row)
  return {
    id: row.id,
    name: row.name,
    slug,
    type: row.type,
    value: decryptSecret(row.encryptedValue, encryptionKey),
  }
}

export function markCredentialUsed(id: string) {
  db.update(schema.upstreamCredentials)
    .set({ lastUsedAt: new Date() })
    .where(eq(schema.upstreamCredentials.id, id))
    .run()
}
