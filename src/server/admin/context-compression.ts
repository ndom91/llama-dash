import { asc, eq, inArray, sql } from 'drizzle-orm'
import { ulid } from 'ulidx'
import * as v from 'valibot'
import type {
  ContextCompressionMatch,
  ContextCompressionPolicy,
  CreateContextCompressionPolicyBody,
  UpdateContextCompressionPolicyBody,
} from '../../lib/schemas/context-compression.ts'
import { ContextCompressionMatchSchema } from '../../lib/schemas/context-compression.ts'
import { db, schema } from '../db/index.ts'

let cache: ContextCompressionPolicy[] | null = null
const clearCache = () => (cache = null)

function toApiShape(row: schema.ContextCompressionPolicy): ContextCompressionPolicy {
  return {
    id: row.id,
    name: row.name,
    enabled: row.enabled,
    order: row.order,
    match: v.parse(ContextCompressionMatchSchema, JSON.parse(row.matchJson)),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export function listContextCompressionPolicies(): ContextCompressionPolicy[] {
  if (cache) return cache
  cache = db
    .select()
    .from(schema.contextCompressionPolicies)
    .orderBy(asc(schema.contextCompressionPolicies.order))
    .all()
    .map(toApiShape)
  return cache
}

export function createContextCompressionPolicy(input: CreateContextCompressionPolicyBody): ContextCompressionPolicy {
  const now = new Date()
  const max = db
    .select({ value: sql<number>`coalesce(max(${schema.contextCompressionPolicies.order}), 0)` })
    .from(schema.contextCompressionPolicies)
    .get()
  const id = `ccp_${ulid()}`
  db.insert(schema.contextCompressionPolicies)
    .values({
      id,
      name: input.name,
      enabled: input.enabled,
      order: (max?.value ?? 0) + 1,
      matchJson: JSON.stringify(input.match),
      createdAt: now,
      updatedAt: now,
    })
    .run()
  clearCache()
  return toApiShape(
    db.select().from(schema.contextCompressionPolicies).where(eq(schema.contextCompressionPolicies.id, id)).get()!,
  )
}

export function updateContextCompressionPolicy(
  id: string,
  input: UpdateContextCompressionPolicyBody,
): ContextCompressionPolicy | null {
  const set: Record<string, unknown> = { updatedAt: new Date() }
  if (input.name !== undefined) set.name = input.name
  if (input.enabled !== undefined) set.enabled = input.enabled
  if (input.match !== undefined) set.matchJson = JSON.stringify(input.match)
  if (
    db.update(schema.contextCompressionPolicies).set(set).where(eq(schema.contextCompressionPolicies.id, id)).run()
      .changes === 0
  )
    return null
  clearCache()
  return toApiShape(
    db.select().from(schema.contextCompressionPolicies).where(eq(schema.contextCompressionPolicies.id, id)).get()!,
  )
}

export function deleteContextCompressionPolicy(id: string): boolean {
  if (
    db.delete(schema.contextCompressionPolicies).where(eq(schema.contextCompressionPolicies.id, id)).run().changes === 0
  )
    return false
  db.select()
    .from(schema.contextCompressionPolicies)
    .orderBy(asc(schema.contextCompressionPolicies.order))
    .all()
    .forEach((row, index) => {
      db.update(schema.contextCompressionPolicies)
        .set({ order: index + 1, updatedAt: new Date() })
        .where(eq(schema.contextCompressionPolicies.id, row.id))
        .run()
    })
  clearCache()
  return true
}

export function reorderContextCompressionPolicies(ids: string[]): ContextCompressionPolicy[] {
  const rows = db
    .select()
    .from(schema.contextCompressionPolicies)
    .where(inArray(schema.contextCompressionPolicies.id, ids))
    .all()
  if (rows.length !== ids.length || db.select().from(schema.contextCompressionPolicies).all().length !== ids.length)
    throw new Error('Reorder payload must include every compression policy exactly once')
  ids.forEach((id, index) => {
    db.update(schema.contextCompressionPolicies)
      .set({ order: index + 1, updatedAt: new Date() })
      .where(eq(schema.contextCompressionPolicies.id, id))
      .run()
  })
  clearCache()
  return listContextCompressionPolicies()
}

export function findContextCompressionPolicy(ctx: {
  endpoint: string
  effectiveModel: string | null
  apiKeyId: string | null
  stream: boolean
  estimatedPromptTokens: number | null
}) {
  return listContextCompressionPolicies().find((rule) => rule.enabled && matches(rule.match, ctx)) ?? null
}

function matches(
  match: ContextCompressionMatch,
  ctx: {
    endpoint: string
    effectiveModel: string | null
    apiKeyId: string | null
    stream: boolean
    estimatedPromptTokens: number | null
  },
) {
  if (
    !matchesList(match.endpoints, ctx.endpoint) ||
    !matchesList(match.effectiveModels, ctx.effectiveModel) ||
    !matchesList(match.apiKeyIds, ctx.apiKeyId)
  )
    return false
  if (match.stream === 'stream' && !ctx.stream) return false
  if (match.stream === 'non_stream' && ctx.stream) return false
  return matchesBounds(match.minEstimatedPromptTokens, match.maxEstimatedPromptTokens, ctx.estimatedPromptTokens)
}
const matchesList = (items: string[], value: string | null) =>
  items.length === 0 || (value !== null && items.includes(value))
function matchesBounds(minRaw: string, maxRaw: string, value: number | null) {
  if (!minRaw && !maxRaw) return true
  if (value === null) return false
  return (!minRaw || value >= Number(minRaw)) && (!maxRaw || value <= Number(maxRaw))
}
