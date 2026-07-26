import { ulid } from 'ulidx'
import type { InflightRequest, InflightRequestPhase } from '../../lib/schemas/request.ts'
import { getApiKeyName } from '../admin/api-keys.ts'
import { publishAdminEvent } from '../admin/events.ts'
import type { ProxyContext } from './context.ts'

export type InflightRegisterInput = {
  id: string
  startedAt: number
  requestClass: 'inference' | 'mcp_relay'
  method: string
  endpoint: string
  model: string | null
  streamed: boolean | null
  phase?: InflightRequestPhase
  keyId: string | null
  clientHost: string | null
  clientName: string | null
  endUserId: string | null
  sessionId: string | null
  routingRuleName: string | null
  routingTargetType: string | null
}

type InflightEntry = InflightRegisterInput & {
  phase: InflightRequestPhase
}

const inflight = new Map<string, InflightEntry>()

export function mintRequestId(): string {
  return `req_${ulid()}`
}

export function clientHostFromHeaderMap(headers: Record<string, string>): string | null {
  const origin = headers.origin
  if (origin) {
    try {
      return new URL(origin).hostname
    } catch {
      return origin
    }
  }
  const xff = headers['x-forwarded-for']
  if (xff) return xff.split(',')[0].trim() || null
  return null
}

export function toInflightApi(entry: InflightEntry): InflightRequest {
  let keyName: string | null = null
  if (entry.keyId) {
    try {
      keyName = getApiKeyName(entry.keyId) ?? null
    } catch {
      keyName = null
    }
  }
  return {
    id: entry.id,
    startedAt: new Date(entry.startedAt).toISOString(),
    requestClass: entry.requestClass,
    method: entry.method,
    endpoint: entry.endpoint,
    model: entry.model,
    streamed: entry.streamed,
    phase: entry.phase,
    keyName,
    clientHost: entry.clientHost,
    clientName: entry.clientName,
    endUserId: entry.endUserId,
    sessionId: entry.sessionId,
    routingRuleName: entry.routingRuleName,
    routingTargetType: entry.routingTargetType,
  }
}

/** Register a live request and publish `request.started`. No-op if already present. */
export function registerInflight(input: InflightRegisterInput): InflightRequest {
  const existing = inflight.get(input.id)
  if (existing) return toInflightApi(existing)

  const entry: InflightEntry = {
    ...input,
    phase: input.phase ?? 'accepted',
  }
  inflight.set(input.id, entry)
  const api = toInflightApi(entry)
  publishAdminEvent('request.started', { request: api })
  return api
}

export function registerProxyInflight(
  ctx: ProxyContext,
  opts: { phase?: InflightRequestPhase; streamed?: boolean | null } = {},
): InflightRequest {
  const model = ctx.routingOutcome.routedModel ?? ctx.routingOutcome.requestedModel ?? ctx.body?.reqModel ?? null
  return registerInflight({
    id: ctx.requestId,
    startedAt: ctx.startedAt,
    requestClass: 'inference',
    method: ctx.method,
    endpoint: ctx.endpoint,
    model,
    streamed: opts.streamed ?? null,
    phase: opts.phase ?? 'accepted',
    keyId: ctx.keyId,
    clientHost: clientHostFromHeaderMap(ctx.reqHeaders),
    clientName: ctx.attribution.clientName,
    endUserId: ctx.attribution.endUserId,
    sessionId: ctx.attribution.sessionId,
    routingRuleName: ctx.routingOutcome.ruleName,
    routingTargetType: ctx.routingOutcome.targetType,
  })
}

/** Update phase/fields and publish `request.updated` when something changed. */
export function updateInflight(
  id: string,
  patch: Partial<Pick<InflightRegisterInput, 'phase' | 'model' | 'streamed'>>,
): InflightRequest | null {
  const entry = inflight.get(id)
  if (!entry) return null

  let changed = false
  if (patch.phase != null && patch.phase !== entry.phase) {
    entry.phase = patch.phase
    changed = true
  }
  if (patch.model !== undefined && patch.model !== entry.model) {
    entry.model = patch.model
    changed = true
  }
  if (patch.streamed !== undefined && patch.streamed !== entry.streamed) {
    entry.streamed = patch.streamed
    changed = true
  }
  if (!changed) return toInflightApi(entry)

  const api = toInflightApi(entry)
  publishAdminEvent('request.updated', { request: api })
  return api
}

/** Remove from the live map (call when the finished log is written). */
export function finishInflight(id: string | null | undefined): void {
  if (!id) return
  inflight.delete(id)
}

export function getInflight(id: string): InflightRequest | null {
  const entry = inflight.get(id)
  return entry ? toInflightApi(entry) : null
}

export function listInflight(): Array<InflightRequest> {
  return [...inflight.values()].sort((a, b) => b.startedAt - a.startedAt).map(toInflightApi)
}

export function resetInflightForTest(): void {
  inflight.clear()
}
