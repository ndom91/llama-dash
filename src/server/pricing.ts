// Per-million-token USD pricing for models we know about. Numbers come from
// public provider pages at time of writing — verify against your actual
// contract / billing before trusting these figures. Unknown models return
// null cost (the UI renders —) rather than silently pricing at zero.
//
// Anthropic prompt-cache pricing is always relative to the base input rate:
//   cache_creation_tokens billed at 1.25 × input
//   cache_read_tokens     billed at 0.10 × input
// so only the base input / output rates live here.

export type ModelPricing = {
  input: number
  output: number
}

const MODEL_PRICING: Array<readonly [string, ModelPricing]> = [
  ['claude-opus-4-7', { input: 15, output: 75 }],
  ['claude-opus-4-6', { input: 15, output: 75 }],
  ['claude-opus-4', { input: 15, output: 75 }],
  ['claude-sonnet-4-6', { input: 3, output: 15 }],
  ['claude-sonnet-4-5', { input: 3, output: 15 }],
  ['claude-sonnet-4', { input: 3, output: 15 }],
  ['claude-haiku-4-5', { input: 0.8, output: 4 }],
  ['claude-haiku-4', { input: 0.8, output: 4 }],
  ['gpt-4o', { input: 2.5, output: 10 }],
  ['gpt-4-turbo', { input: 10, output: 30 }],
]

function findPricing(model: string): ModelPricing | null {
  for (const [prefix, price] of MODEL_PRICING) {
    if (model === prefix || model.startsWith(`${prefix}-`) || model.startsWith(`${prefix}[`)) {
      return price
    }
  }
  return null
}

export type UsageForPricing = {
  promptTokens: number | null
  completionTokens: number | null
  cacheCreationTokens: number | null
  cacheReadTokens: number | null
}

export function computeCostUsd(model: string | null, usage: UsageForPricing): number | null {
  if (!model) return null
  const p = findPricing(model)
  if (!p) return null
  const cacheWriteRate = p.input * 1.25
  const cacheReadRate = p.input * 0.1
  const cost =
    ((usage.promptTokens ?? 0) * p.input +
      (usage.completionTokens ?? 0) * p.output +
      (usage.cacheCreationTokens ?? 0) * cacheWriteRate +
      (usage.cacheReadTokens ?? 0) * cacheReadRate) /
    1_000_000
  return cost > 0 ? cost : null
}
