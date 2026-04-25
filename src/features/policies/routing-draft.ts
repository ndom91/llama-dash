import type { RoutingRule } from '../../lib/api'
import { coerceAction, type RoutingActionType, type RoutingStreamMode } from './routing-ui'

type MatchListField = 'apiKeyIds' | 'endpoints' | 'requestedModels'

export function addMatchValue(draft: RoutingRule, field: MatchListField, value: string): RoutingRule {
  return { ...draft, match: { ...draft.match, [field]: [...draft.match[field], value] } }
}

export function removeMatchValue(draft: RoutingRule, field: MatchListField, value: string): RoutingRule {
  return { ...draft, match: { ...draft.match, [field]: draft.match[field].filter((item) => item !== value) } }
}

export function setMatchField<K extends keyof RoutingRule['match']>(
  draft: RoutingRule,
  field: K,
  value: RoutingRule['match'][K],
): RoutingRule {
  return { ...draft, match: { ...draft.match, [field]: value } }
}

export function setActionType(draft: RoutingRule, type: RoutingActionType): RoutingRule {
  return { ...draft, action: coerceAction(type, draft.action) }
}

export function setRewriteModel(draft: RoutingRule, model: string): RoutingRule {
  return { ...draft, action: { type: 'rewrite_model', model } }
}

export function setRejectReason(draft: RoutingRule, reason: string): RoutingRule {
  return { ...draft, action: { type: 'reject', reason } }
}

export function setAuthMode(draft: RoutingRule, authMode: RoutingRule['authMode']): RoutingRule {
  return { ...draft, authMode, preserveAuthorization: authMode === 'passthrough' }
}

export function togglePreserveAuthorization(draft: RoutingRule): RoutingRule {
  return { ...draft, preserveAuthorization: !draft.preserveAuthorization }
}

export function setTargetType(draft: RoutingRule, type: RoutingRule['target']['type']): RoutingRule {
  return {
    ...draft,
    target:
      type === 'direct'
        ? { type: 'direct', baseUrl: draft.target.type === 'direct' ? draft.target.baseUrl : '' }
        : { type },
  }
}

export function setDirectTargetBaseUrl(draft: RoutingRule, baseUrl: string): RoutingRule {
  return { ...draft, target: { type: 'direct', baseUrl } }
}

export function asStreamMode(value: string): RoutingStreamMode {
  return value === 'stream' || value === 'non_stream' ? value : 'any'
}
