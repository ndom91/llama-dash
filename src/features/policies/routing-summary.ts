import type { RoutingRule } from '../../lib/api'

export function formatRuleSummary(rule: RoutingRule, keyMap: Map<string, string>) {
  const whenBits: string[] = []
  if (rule.match.endpoints.length > 0) whenBits.push(`endpoint is ${rule.match.endpoints.join(', ')}`)
  if (rule.match.requestedModels.length > 0)
    whenBits.push(`requested model is ${rule.match.requestedModels.join(', ')}`)
  if (rule.match.apiKeyIds.length > 0) {
    const names = rule.match.apiKeyIds.map((id) => keyMap.get(id) ?? id)
    whenBits.push(`api key is ${names.join(', ')}`)
  }
  if (rule.match.stream !== 'any')
    whenBits.push(`stream is ${rule.match.stream === 'stream' ? 'stream' : 'non-stream'}`)
  if (rule.match.minEstimatedPromptTokens) whenBits.push(`est. prompt tokens >= ${rule.match.minEstimatedPromptTokens}`)
  if (rule.match.maxEstimatedPromptTokens) whenBits.push(`est. prompt tokens <= ${rule.match.maxEstimatedPromptTokens}`)

  const then =
    rule.action.type === 'rewrite_model'
      ? `rewrite model to ${rule.action.model || '-'}`
      : rule.action.type === 'reject'
        ? `reject with reason "${rule.action.reason || '-'}"`
        : 'continue unchanged'
  const auth =
    rule.authMode === 'passthrough'
      ? `passthrough auth${rule.preserveAuthorization ? ' · keep Authorization' : ''}`
      : 'require llama-dash key'
  const target = rule.target.type === 'direct' ? `direct upstream ${rule.target.baseUrl}` : 'llama-swap'

  return {
    when: whenBits.length > 0 ? whenBits : ['matches any request'],
    then,
    auth,
    target,
  }
}
