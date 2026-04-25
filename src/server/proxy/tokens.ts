export function estimatePromptTokens(body: Record<string, unknown>): number | null {
  const parts = getPromptTokenEstimateParts(body)
  if (parts.length === 0) return null
  return estimateTokensFromJson(parts)
}

export function getPromptTokenEstimateParts(body: Record<string, unknown>): unknown[] {
  const parts: unknown[] = []
  if (Array.isArray(body.messages)) parts.push(body.messages)
  if (body.system != null) parts.push(body.system)
  if (Array.isArray(body.tools)) parts.push(body.tools)
  return parts
}

export function estimateTokensFromJson(value: unknown): number {
  return Math.ceil(JSON.stringify(value).length / 4)
}
