import { desc, eq } from 'drizzle-orm'
import { ulid } from 'ulidx'
import type { ModelAliasItem } from '../../lib/schemas/model-alias.ts'
import { db, schema } from '../db/index.ts'

let _cache: Map<string, string> | null = null

function getCache(): Map<string, string> {
  if (_cache) return _cache
  const rows = db.select().from(schema.modelAliases).all()
  _cache = new Map(rows.map((r) => [r.alias, r.model]))
  return _cache
}

function invalidateCache() {
  _cache = null
}

export function resolveAlias(model: string): string {
  const cache = getCache()
  return cache.get(model) ?? model
}

export function listModelAliases(): Array<ModelAliasItem> {
  return db.select().from(schema.modelAliases).orderBy(desc(schema.modelAliases.createdAt)).all().map(toApiShape)
}

export function createModelAlias(input: { alias: string; model: string }): ModelAliasItem {
  const id = `mal_${ulid()}`
  const now = new Date()

  db.insert(schema.modelAliases).values({ id, alias: input.alias, model: input.model, createdAt: now }).run()

  invalidateCache()
  return toApiShape({ id, alias: input.alias, model: input.model, createdAt: now })
}

export function updateModelAlias(id: string, fields: { alias?: string; model?: string }): ModelAliasItem | null {
  const set: Record<string, unknown> = {}
  if (fields.alias != null) set.alias = fields.alias
  if (fields.model != null) set.model = fields.model
  if (Object.keys(set).length === 0) return null

  const result = db.update(schema.modelAliases).set(set).where(eq(schema.modelAliases.id, id)).run()
  if (result.changes === 0) return null

  invalidateCache()
  const row = db.select().from(schema.modelAliases).where(eq(schema.modelAliases.id, id)).get()
  return row ? toApiShape(row) : null
}

export function deleteModelAlias(id: string): boolean {
  const result = db.delete(schema.modelAliases).where(eq(schema.modelAliases.id, id)).run()
  invalidateCache()
  return result.changes > 0
}

function toApiShape(row: schema.ModelAlias): ModelAliasItem {
  return {
    id: row.id,
    alias: row.alias,
    model: row.model,
    createdAt: row.createdAt.toISOString(),
  }
}
