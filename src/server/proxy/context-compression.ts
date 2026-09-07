import { findContextCompressionPolicy } from '../admin/context-compression.ts'
import { config } from '../config.ts'
import { compressHeadroomMessages } from '../headroom/client.ts'
import { estimateTokensFromJson } from './tokens.ts'

export type CompressionOutcome = {
  policyId: string | null
  policyName: string | null
  status: 'not_matched' | 'skipped' | 'compressed' | 'unavailable' | 'failed'
  inputTokens: number | null
  outputTokens: number | null
  elapsedMs: number | null
}

export function emptyCompressionOutcome(): CompressionOutcome {
  return {
    policyId: null,
    policyName: null,
    status: 'not_matched',
    inputTokens: null,
    outputTokens: null,
    elapsedMs: null,
  }
}

export async function applyContextCompression(input: {
  body: Record<string, unknown>
  endpoint: string
  keyId: string | null
}): Promise<{ body: Record<string, unknown>; mutated: boolean; outcome: CompressionOutcome }> {
  const { body, endpoint, keyId } = input
  if (endpoint !== '/v1/chat/completions' && endpoint !== '/v1/messages')
    return { body, mutated: false, outcome: emptyCompressionOutcome() }
  if (!Array.isArray(body.messages) || typeof body.model !== 'string')
    return { body, mutated: false, outcome: emptyCompressionOutcome() }
  const inputTokens = estimateTokensFromJson([body.messages])
  const policy = findContextCompressionPolicy({
    endpoint,
    effectiveModel: body.model,
    apiKeyId: keyId,
    stream: body.stream === true,
    estimatedPromptTokens: inputTokens,
  })
  if (!policy) return { body, mutated: false, outcome: emptyCompressionOutcome() }
  const base = { policyId: policy.id, policyName: policy.name, inputTokens, outputTokens: null, elapsedMs: null }
  if (!config.headroomBaseUrl) return { body, mutated: false, outcome: { ...base, status: 'unavailable' } }
  const startedAt = Date.now()
  const messages = await compressHeadroomMessages(body.messages, body.model)
  const elapsedMs = Date.now() - startedAt
  if (!messages) return { body, mutated: false, outcome: { ...base, status: 'failed', elapsedMs } }
  const outputTokens = estimateTokensFromJson([messages])
  if (outputTokens >= inputTokens)
    return { body, mutated: false, outcome: { ...base, status: 'skipped', outputTokens, elapsedMs } }
  return {
    body: { ...body, messages },
    mutated: true,
    outcome: { ...base, status: 'compressed', outputTokens, elapsedMs },
  }
}
