import type { ApiRequest } from './api'
import type { InflightRequest, InflightRequestPhase } from './schemas/request'

/** List row that may be a finished log or a live in-flight exchange. */
export type RequestListItem = ApiRequest & {
  inflightPhase?: InflightRequestPhase
}

export function inflightToListItem(row: InflightRequest, nowMs: number): RequestListItem {
  const started = Date.parse(row.startedAt)
  return {
    id: row.id,
    startedAt: row.startedAt,
    durationMs: Number.isFinite(started) ? Math.max(0, nowMs - started) : 0,
    requestClass: row.requestClass,
    method: row.method,
    endpoint: row.endpoint,
    model: row.model,
    statusCode: 0,
    promptTokens: null,
    completionTokens: null,
    cacheCreationTokens: null,
    cacheReadTokens: null,
    costUsd: null,
    streamed: row.streamed ?? false,
    error: null,
    queueMs: null,
    modelLoadingMs: null,
    prefillMs: null,
    reasoningMs: null,
    responseMs: null,
    keyName: row.keyName,
    clientHost: row.clientHost,
    clientName: row.clientName,
    endUserId: row.endUserId,
    sessionId: row.sessionId,
    routingRuleName: row.routingRuleName,
    routingActionType: null,
    routingAuthMode: null,
    routingPreserveAuthorization: false,
    routingTargetType: row.routingTargetType,
    routingTargetBaseUrl: null,
    routingTargetCredentialId: null,
    routingRoutedModel: null,
    credentialInjectionJson: null,
    inflightPhase: row.phase,
  }
}

export function mergeInflightIntoList(
  completed: Array<ApiRequest>,
  inflight: Array<InflightRequest>,
  nowMs: number,
  opts: { includeMcp?: boolean } = {},
): Array<RequestListItem> {
  const includeMcp = opts.includeMcp !== false
  const live = inflight
    .filter((row) => includeMcp || row.requestClass !== 'mcp_relay')
    .map((row) => inflightToListItem(row, nowMs))
  const liveIds = new Set(live.map((row) => row.id))
  const done = completed.filter((row) => !liveIds.has(row.id))
  return [...live, ...done]
}

export function inflightPhaseLabel(phase: InflightRequestPhase): string {
  if (phase === 'queued') return 'queued'
  if (phase === 'active') return 'active'
  return 'live'
}
