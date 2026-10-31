import { eq } from 'drizzle-orm'
import { ulid } from 'ulidx'
import * as v from 'valibot'
import type { ConnectProviderBody, ProviderConnection, ProviderTestResult } from '../../lib/schemas/provider.ts'
import { findProviderTarget, providerAuthValue, providerModelsUrl, type ProviderTarget } from '../../lib/providers.ts'
import { db, schema } from '../db/index.ts'
import { config } from '../config.ts'
import {
  createUpstreamCredential,
  deleteUpstreamCredential,
  getCredentialInjectionSecret,
} from './upstream-credentials.ts'
import { createRoutingRule, deleteRoutingRule, listRoutingRules, reorderRoutingRules } from './routing-rules.ts'

/**
 * Provider connections let the operator hand llswap-dash a subscription API key
 * (MiniMax, Xiaomi MiMo, Z.AI GLM) and route OpenAI-/Anthropic-compatible
 * traffic to it. Connecting one target creates:
 *
 * 1. one encrypted upstream credential holding the provider key,
 * 2. one routing rule per API surface the target exposes, and
 * 3. an auto-discovered model list, fetched live from the provider.
 *
 * The rules are created at the top of the order so they win over catch-all
 * rules the operator already has.
 */

const ModelsListSchema = v.object({
  data: v.optional(
    v.array(
      v.object({
        id: v.optional(v.string()),
      }),
    ),
  ),
})

function parseJsonStringArray(raw: string): string[] {
  try {
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []
  } catch {
    return []
  }
}

function toApiShape(row: schema.ProviderConnection): ProviderConnection {
  const target = findProviderTarget(row.targetId)
  const credential = db
    .select()
    .from(schema.upstreamCredentials)
    .where(eq(schema.upstreamCredentials.id, row.credentialId))
    .get()
  return {
    id: row.id,
    targetId: row.targetId,
    targetLabel: target?.label ?? row.targetId,
    credentialId: row.credentialId,
    credentialName: credential?.name ?? 'unknown',
    routingRuleIds: parseJsonStringArray(row.routingRuleIdsJson),
    models: parseJsonStringArray(row.modelsJson),
    modelsDiscoveredAt: row.modelsDiscoveredAt?.toISOString() ?? null,
    enabled: row.enabled,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export function listProviderConnections(): ProviderConnection[] {
  return db.select().from(schema.providerConnections).all().map(toApiShape)
}

export function getProviderConnection(targetId: string): ProviderConnection | null {
  const row = db
    .select()
    .from(schema.providerConnections)
    .where(eq(schema.providerConnections.targetId, targetId))
    .get()
  return row ? toApiShape(row) : null
}

/** The stored provider key, used by model discovery and the "test" probe. */
export function providerApiKey(targetId: string): string | null {
  const connection = getProviderConnection(targetId)
  if (!connection) return null
  const secret = getCredentialInjectionSecret(connection.credentialId, config.credentialEncryptionKey)
  return secret?.value ?? null
}

async function probeSurfaceModels(
  target: ProviderTarget,
  apiKey: string,
): Promise<{
  ok: boolean
  status: number
  latencyMs: number
  message: string
  models: string[]
}> {
  let lastStatus = 0
  let lastMessage = 'No surface responded'
  let lastLatency = 0
  for (const surface of target.surfaces) {
    const url = providerModelsUrl(`${target.origin.replace(/\/$/, '')}${surface.path}`, surface.pathJoin)
    const headers: Record<string, string> = {}
    for (const binding of surface.authHeaders) {
      headers[binding.name] = providerAuthValue(binding, apiKey)
    }
    const startedAt = Date.now()
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(15_000),
      })
      lastLatency = Date.now() - startedAt
      lastStatus = response.status
      if (!response.ok) {
        const detail = (await response.text().catch(() => '')).slice(0, 200)
        lastMessage = `Provider returned ${response.status}${detail ? ` — ${detail}` : ''}`
        continue
      }
      const result = v.safeParse(ModelsListSchema, await response.json().catch(() => ({})))
      const models = result.success
        ? (result.output.data ?? []).map((entry) => entry.id).filter((id): id is string => Boolean(id))
        : []
      return {
        ok: true,
        status: response.status,
        latencyMs: lastLatency,
        message: `Provider reachable and key accepted · ${models.length} models`,
        models,
      }
    } catch (err) {
      lastLatency = Date.now() - startedAt
      lastMessage = err instanceof Error ? err.message : String(err)
    }
  }
  return { ok: false, status: lastStatus, latencyMs: lastLatency, message: lastMessage, models: [] }
}

/** Probe a target to confirm the key works and discover its models. */
export async function testProviderConnection(targetId: string, adHocKey?: string): Promise<ProviderTestResult> {
  const target = findProviderTarget(targetId)
  if (!target) throw new Error(`Unknown provider target: ${targetId}`)

  const apiKey = adHocKey?.trim() || providerApiKey(targetId)
  if (!apiKey) throw new Error('No API key available for this provider')

  return probeSurfaceModels(target, apiKey)
}

/** Re-fetch the model list for a connected target. */
export async function refreshProviderModels(targetId: string): Promise<ProviderConnection> {
  const connection = getProviderConnection(targetId)
  if (!connection) throw new Error('Provider is not connected')
  const target = findProviderTarget(targetId)
  if (!target) throw new Error(`Unknown provider target: ${targetId}`)

  const apiKey = providerApiKey(targetId)
  if (!apiKey) throw new Error('No API key available for this provider')

  const probe = await probeSurfaceModels(target, apiKey)
  const now = new Date()
  db.update(schema.providerConnections)
    .set({
      modelsJson: JSON.stringify(probe.models),
      modelsDiscoveredAt: now,
      updatedAt: now,
    })
    .where(eq(schema.providerConnections.id, connection.id))
    .run()
  return toApiShape(
    db.select().from(schema.providerConnections).where(eq(schema.providerConnections.id, connection.id)).get()!,
  )
}

export async function connectProvider(input: ConnectProviderBody): Promise<ProviderConnection> {
  const target = findProviderTarget(input.targetId)
  if (!target) throw new Error(`Unknown provider target: ${input.targetId}`)

  const existing = getProviderConnection(input.targetId)
  if (existing) throw new Error(`${target.label} is already connected`)

  const apiKey = input.apiKey.trim()
  const credential = createUpstreamCredential(
    {
      name: input.name?.trim() || `${target.label} key`,
      type: 'api_key',
      value: apiKey,
    },
    config.credentialEncryptionKey,
  )

  // Discover models up front so routing rules and the Models page know what
  // this provider serves — the provider is the source of truth, not us.
  const probe = await probeSurfaceModels(target, apiKey)

  // One routing rule per surface: each claims only that surface's proxy
  // endpoints and forwards to that surface's mount path on the target origin.
  const ruleIds: string[] = []
  try {
    for (const surface of target.surfaces) {
      const rule = createRoutingRule({
        name: `${target.label} · ${surface.apiStyle}`,
        enabled: true,
        match: {
          endpoints: [...surface.matchEndpoints],
          requestedModels: [],
          apiKeyIds: [],
          stream: 'any' as const,
          minEstimatedPromptTokens: '',
          maxEstimatedPromptTokens: '',
        },
        action: { type: 'continue' as const },
        target: {
          type: 'direct' as const,
          baseUrl: `${target.origin.replace(/\/$/, '')}${surface.path}`,
          credentialId: credential.id,
          pathJoin: surface.pathJoin,
        },
        authMode: 'require_key' as const,
        preserveAuthorization: false,
        credentialBindings: [],
      })
      ruleIds.push(rule.id)
    }
  } catch (err) {
    for (const ruleId of ruleIds) deleteRoutingRule(ruleId)
    deleteUpstreamCredential(credential.id)
    throw err
  }

  // Provider rules should win over catch-all rules the operator already has.
  const ordered = [
    ...ruleIds,
    ...listRoutingRules()
      .map((rule) => rule.id)
      .filter((id) => !ruleIds.includes(id)),
  ]
  reorderRoutingRules(ordered)

  const id = `prv_${ulid()}`
  const now = new Date()
  db.insert(schema.providerConnections)
    .values({
      id,
      targetId: target.id,
      credentialId: credential.id,
      routingRuleIdsJson: JSON.stringify(ruleIds),
      modelsJson: JSON.stringify(probe.models),
      modelsDiscoveredAt: probe.models.length > 0 ? now : null,
      enabled: true,
      createdAt: now,
      updatedAt: now,
    })
    .run()

  return toApiShape(db.select().from(schema.providerConnections).where(eq(schema.providerConnections.id, id)).get()!)
}

export function disconnectProvider(targetId: string): boolean {
  const connection = getProviderConnection(targetId)
  if (!connection) return false

  for (const ruleId of connection.routingRuleIds) deleteRoutingRule(ruleId)
  deleteUpstreamCredential(connection.credentialId)
  db.delete(schema.providerConnections).where(eq(schema.providerConnections.id, connection.id)).run()
  return true
}
