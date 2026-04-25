import { asc, eq, inArray, sql } from 'drizzle-orm'
import { ulid } from 'ulidx'
import * as v from 'valibot'
import type { CreateRoutingRuleBody, RoutingRule, UpdateRoutingRuleBody } from '../../lib/schemas/routing-rule.ts'
import { RoutingActionSchema, RoutingMatchSchema, RoutingTargetSchema } from '../../lib/schemas/routing-rule.ts'
import {
  hasAnyRoutingMatcher,
  isAllowedDirectUpstream,
  ROUTING_MATCH_FIELD_METADATA,
} from '../../lib/schemas/routing-rule.ts'
import { db, schema } from '../db/index.ts'

let _cache: RoutingRule[] | null = null

function invalidateCache() {
  _cache = null
}

function parseJson<T>(raw: string, schemaType: v.GenericSchema<T>): T {
  return v.parse(schemaType, JSON.parse(raw))
}

function toApiShape(row: schema.RoutingRule): RoutingRule {
  return {
    id: row.id,
    name: row.name,
    enabled: row.enabled,
    order: row.order,
    match: parseJson(row.matchJson, RoutingMatchSchema),
    action: parseJson(row.actionJson, RoutingActionSchema),
    target: parseJson(row.targetJson, RoutingTargetSchema),
    authMode: row.authMode,
    preserveAuthorization: row.preserveAuthorization,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export function listRoutingRules(): RoutingRule[] {
  if (_cache) return _cache
  _cache = db.select().from(schema.routingRules).orderBy(asc(schema.routingRules.order)).all().map(toApiShape)
  return _cache
}

export function createRoutingRule(input: CreateRoutingRuleBody): RoutingRule {
  const id = `rrl_${ulid()}`
  const now = new Date()
  const currentMax = db
    .select({ value: sql<number>`coalesce(max(${schema.routingRules.order}), 0)` })
    .from(schema.routingRules)
    .get()
  const order = (currentMax?.value ?? 0) + 1
  db.insert(schema.routingRules)
    .values({
      id,
      name: input.name,
      enabled: input.enabled,
      order,
      matchJson: JSON.stringify(input.match),
      actionJson: JSON.stringify(input.action),
      targetJson: JSON.stringify(input.target ?? { type: 'llama_swap' }),
      authMode: input.authMode ?? 'require_key',
      preserveAuthorization: input.authMode === 'passthrough' ? (input.preserveAuthorization ?? false) : false,
      createdAt: now,
      updatedAt: now,
    })
    .run()
  invalidateCache()
  return toApiShape(db.select().from(schema.routingRules).where(eq(schema.routingRules.id, id)).get()!)
}

export function updateRoutingRule(id: string, fields: UpdateRoutingRuleBody): RoutingRule | null {
  const existing = db.select().from(schema.routingRules).where(eq(schema.routingRules.id, id)).get()
  if (!existing) return null
  const nextRule = { ...toApiShape(existing), ...fields }
  validateRoutingRuleSafety(nextRule)

  const set: Record<string, unknown> = { updatedAt: new Date() }
  if (fields.name !== undefined) set.name = fields.name
  if (fields.enabled !== undefined) set.enabled = fields.enabled
  if (fields.match !== undefined) set.matchJson = JSON.stringify(fields.match)
  if (fields.action !== undefined) set.actionJson = JSON.stringify(fields.action)
  if (fields.target !== undefined) set.targetJson = JSON.stringify(fields.target)
  if (fields.authMode !== undefined) set.authMode = fields.authMode
  if (fields.preserveAuthorization !== undefined) set.preserveAuthorization = fields.preserveAuthorization
  if (fields.authMode === 'require_key') set.preserveAuthorization = false
  const result = db.update(schema.routingRules).set(set).where(eq(schema.routingRules.id, id)).run()
  if (result.changes === 0) return null
  invalidateCache()
  const row = db.select().from(schema.routingRules).where(eq(schema.routingRules.id, id)).get()
  return row ? toApiShape(row) : null
}

function validateRoutingRuleSafety(rule: Pick<RoutingRule, 'authMode' | 'match' | 'target'>) {
  if (rule.target.type === 'direct' && !isAllowedDirectUpstream(rule.target.baseUrl)) {
    throw new Error('Direct upstreams are currently limited to api.openai.com and api.anthropic.com')
  }
  if (rule.target.type === 'direct' && rule.authMode === 'passthrough' && !hasAnyRoutingMatcher(rule.match)) {
    throw new Error('Direct passthrough routing rules require at least one matcher')
  }
}

export function deleteRoutingRule(id: string): boolean {
  const row = db.select().from(schema.routingRules).where(eq(schema.routingRules.id, id)).get()
  if (!row) return false
  db.delete(schema.routingRules).where(eq(schema.routingRules.id, id)).run()
  const remaining = db.select().from(schema.routingRules).orderBy(asc(schema.routingRules.order)).all()
  remaining.forEach((item, index) => {
    db.update(schema.routingRules)
      .set({ order: index + 1, updatedAt: new Date() })
      .where(eq(schema.routingRules.id, item.id))
      .run()
  })
  invalidateCache()
  return true
}

export function reorderRoutingRules(ids: string[]): RoutingRule[] {
  const allRows = db.select().from(schema.routingRules).all()
  const rows = db.select().from(schema.routingRules).where(inArray(schema.routingRules.id, ids)).all()
  if (rows.length !== ids.length) throw new Error('All routing rules must exist to reorder')
  if (allRows.length !== ids.length) throw new Error('Reorder payload must include every routing rule exactly once')
  ids.forEach((id, index) => {
    db.update(schema.routingRules)
      .set({ order: index + 1, updatedAt: new Date() })
      .where(eq(schema.routingRules.id, id))
      .run()
  })
  invalidateCache()
  return listRoutingRules()
}

export type RoutingContext = {
  endpoint: string
  requestedModel: string | null
  apiKeyId: string | null
  stream: boolean
  estimatedPromptTokens: number | null
  headers?: Headers
}

export type RoutingDecision =
  | {
      matchedRule: RoutingRule | null
      action: null
      target: { type: 'llama_swap' }
      authMode: 'require_key'
      preserveAuthorization: false
    }
  | {
      matchedRule: RoutingRule
      action: { type: 'rewrite_model'; model: string } | { type: 'reject'; reason: string } | { type: 'noop' }
      target: RoutingRule['target']
      authMode: RoutingRule['authMode']
      preserveAuthorization: boolean
    }

function matchesStringList(values: string[], current: string | null): boolean {
  if (values.length === 0) return true
  if (!current) return false
  return values.includes(current)
}

function matchesNumberBounds(minRaw: string, maxRaw: string, value: number | null): boolean {
  const min = minRaw ? Number(minRaw) : null
  const max = maxRaw ? Number(maxRaw) : null
  if (min == null && max == null) return true
  if (value == null) return false
  if (min != null && value < min) return false
  if (max != null && value > max) return false
  return true
}

export function matchesRoutingRule(rule: RoutingRule, ctx: RoutingContext): boolean {
  if (!rule.enabled) return false
  if (!matchesStringList(rule.match.endpoints, ctx.endpoint)) return false
  if (!matchesStringList(rule.match.requestedModels, ctx.requestedModel)) return false
  if (!matchesStringList(rule.match.apiKeyIds, ctx.apiKeyId)) return false
  if (rule.match.stream === 'stream' && !ctx.stream) return false
  if (rule.match.stream === 'non_stream' && ctx.stream) return false
  if (
    !matchesNumberBounds(
      rule.match.minEstimatedPromptTokens,
      rule.match.maxEstimatedPromptTokens,
      ctx.estimatedPromptTokens,
    )
  ) {
    return false
  }
  return true
}

export function evaluateRoutingRules(rules: RoutingRule[], ctx: RoutingContext): RoutingDecision {
  for (const rule of rules) {
    if (!matchesRoutingRule(rule, ctx)) continue
    const meta = { target: rule.target, authMode: rule.authMode, preserveAuthorization: rule.preserveAuthorization }
    if (rule.action.type === 'rewrite_model') {
      return { matchedRule: rule, action: { type: 'rewrite_model', model: rule.action.model }, ...meta }
    }
    if (rule.action.type === 'noop') {
      return { matchedRule: rule, action: { type: 'noop' }, ...meta }
    }
    return { matchedRule: rule, action: { type: 'reject', reason: rule.action.reason }, ...meta }
  }
  return {
    matchedRule: null,
    action: null,
    target: { type: 'llama_swap' },
    authMode: 'require_key',
    preserveAuthorization: false,
  }
}

export function evaluatePreAuthRoutingRules(
  rules: RoutingRule[],
  ctx: Omit<RoutingContext, 'apiKeyId'>,
): RoutingDecision {
  return evaluateRoutingRules(rules.filter(isPreAuthRoutingCandidate), { ...ctx, apiKeyId: null })
}

export function hasBodyDependentPreAuthRoutingRule(rules: RoutingRule[]): boolean {
  return rules.some((rule) => isPreAuthRoutingCandidate(rule) && needsBodyForPreAuthRouting(rule))
}

function isPreAuthRoutingCandidate(rule: RoutingRule): boolean {
  return rule.authMode === 'passthrough' && rule.match.apiKeyIds.length === 0
}

function needsBodyForPreAuthRouting(rule: RoutingRule): boolean {
  return (
    (ROUTING_MATCH_FIELD_METADATA.requestedModels.requiresBodyForPreAuth && rule.match.requestedModels.length > 0) ||
    (ROUTING_MATCH_FIELD_METADATA.stream.requiresBodyForPreAuth && rule.match.stream !== 'any') ||
    (ROUTING_MATCH_FIELD_METADATA.minEstimatedPromptTokens.requiresBodyForPreAuth &&
      rule.match.minEstimatedPromptTokens !== '') ||
    (ROUTING_MATCH_FIELD_METADATA.maxEstimatedPromptTokens.requiresBodyForPreAuth &&
      rule.match.maxEstimatedPromptTokens !== '')
  )
}
