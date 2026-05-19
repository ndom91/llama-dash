import * as v from 'valibot'

export type ModelPricing = {
  input: number
  output: number
  cacheRead: number | null
  cacheWrite: number | null
}

type ModelPricingEntry = {
  model: string
  provider: string
  pricing: ModelPricing
}

type ModelPricingBuildResult = {
  entries: ModelPricingEntry[]
  skippedRecords: number
  partialCacheRecords: number
  skippedSamples: string[]
  partialCacheSamples: string[]
}

type ModelPricingCandidate = ModelPricingEntry & {
  providerPriority: number
  score: number
}

export type ModelPricingStatus =
  | { status: 'idle' | 'loading' }
  | { status: 'ready'; count: number; skippedRecords: number; partialCacheRecords: number }
  | { status: 'unavailable'; reason: string }

const MODELS_DEV_API_URL = 'https://models.dev/api.json'

const ModelsDevCostSchema = v.object({
  input: v.optional(v.number()),
  output: v.optional(v.number()),
  cache_read: v.optional(v.number()),
  cache_write: v.optional(v.number()),
})

const ModelsDevModelSchema = v.object({
  id: v.string(),
  cost: v.optional(ModelsDevCostSchema),
})

const ModelsDevProviderSchema = v.object({
  models: v.record(v.string(), v.unknown()),
})

const ModelsDevResponseSchema = v.record(v.string(), v.unknown())

let MODEL_PRICING: ModelPricingEntry[] = []
let modelPricingStatus: ModelPricingStatus = { status: 'idle' }

const PROVIDER_PRIORITY: Record<string, number> = {
  anthropic: 0,
  cerebras: 0,
  cohere: 0,
  deepseek: 0,
  google: 0,
  groq: 0,
  minimax: 0,
  mistral: 0,
  moonshotai: 0,
  openai: 0,
  perplexity: 0,
  togetherai: 0,
  xai: 0,
  zai: 0,
  'google-vertex': 1,
  openrouter: 10,
}

const normalizeModel = (model: string) => model.toLowerCase()

const toRate = (value: number | undefined): number | null =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null

const pricingScore = (pricing: ModelPricing) =>
  pricing.input + pricing.output + (pricing.cacheRead ?? 0) + (pricing.cacheWrite ?? 0)

const hasPositiveBasePrice = (pricing: ModelPricing) => pricing.input > 0 || pricing.output > 0

const cacheCompleteness = (pricing: ModelPricing) =>
  Number(pricing.cacheRead != null) + Number(pricing.cacheWrite != null)

class PricingCatalogUnavailableError extends Error {
  override name = 'PricingCatalogUnavailableError'
}

function shouldReplacePricing(existing: ModelPricingCandidate | undefined, next: ModelPricingCandidate) {
  if (!existing) return true
  if (next.providerPriority < existing.providerPriority) return true
  if (next.providerPriority > existing.providerPriority) return false

  const nextHasPrice = hasPositiveBasePrice(next.pricing)
  const existingHasPrice = hasPositiveBasePrice(existing.pricing)
  if (nextHasPrice !== existingHasPrice) return nextHasPrice

  const nextCacheCompleteness = cacheCompleteness(next.pricing)
  const existingCacheCompleteness = cacheCompleteness(existing.pricing)
  if (nextCacheCompleteness !== existingCacheCompleteness) return nextCacheCompleteness > existingCacheCompleteness

  return existing.score === 0 && next.score > 0
}

function recordSample(samples: string[], providerId: string, modelId: string, reason: string) {
  if (samples.length < 20) samples.push(`${providerId}/${modelId}: ${reason}`)
}

function buildModelPricingResult(data: unknown): ModelPricingBuildResult {
  const root = v.safeParse(ModelsDevResponseSchema, data)
  if (!root.success) throw new PricingCatalogUnavailableError('models.dev response root was not a provider map')

  const byModel = new Map<string, ModelPricingCandidate>()
  let skippedRecords = 0
  let partialCacheRecords = 0
  const skippedSamples: string[] = []
  const partialCacheSamples: string[] = []

  for (const [providerId, rawProvider] of Object.entries(root.output)) {
    const provider = v.safeParse(ModelsDevProviderSchema, rawProvider)
    if (!provider.success) {
      skippedRecords++
      recordSample(skippedSamples, providerId, '*', 'invalid provider record')
      continue
    }

    for (const [modelKey, rawModel] of Object.entries(provider.output.models)) {
      const parsedModel = v.safeParse(ModelsDevModelSchema, rawModel)
      if (!parsedModel.success) {
        skippedRecords++
        recordSample(skippedSamples, providerId, modelKey, 'invalid model record')
        continue
      }

      const model = parsedModel.output
      const cost = model.cost
      if (!cost) {
        skippedRecords++
        recordSample(skippedSamples, providerId, model.id, 'missing cost')
        continue
      }

      const input = toRate(cost.input)
      const output = toRate(cost.output)
      if (input == null || output == null) {
        skippedRecords++
        recordSample(skippedSamples, providerId, model.id, 'missing input/output pricing')
        continue
      }

      const pricing: ModelPricing = {
        input,
        output,
        cacheRead: toRate(cost.cache_read),
        cacheWrite: toRate(cost.cache_write),
      }
      if (pricing.cacheRead == null || pricing.cacheWrite == null) {
        partialCacheRecords++
        recordSample(partialCacheSamples, providerId, model.id, 'missing cache-specific pricing')
      }
      const candidate: ModelPricingCandidate = {
        model: normalizeModel(model.id),
        provider: providerId,
        providerPriority: PROVIDER_PRIORITY[providerId] ?? 100,
        pricing,
        score: pricingScore(pricing),
      }
      const existing = byModel.get(candidate.model)

      // Many providers expose subscription/proxy variants or reseller markup
      // for common IDs. Prefer canonical providers, then non-zero pricing.
      if (shouldReplacePricing(existing, candidate)) {
        byModel.set(candidate.model, candidate)
      }
    }
  }

  const entries = [...byModel.values()]
    .map(({ model, provider, pricing }) => ({ model, provider, pricing }))
    .sort((a, b) => b.model.length - a.model.length)

  return { entries, skippedRecords, partialCacheRecords, skippedSamples, partialCacheSamples }
}

export function buildModelPricingFromModelsDev(data: unknown): ModelPricingEntry[] {
  return buildModelPricingResult(data).entries
}

async function fetchModelsDevCatalog(): Promise<unknown> {
  try {
    const res = await fetch(MODELS_DEV_API_URL, {
      signal: AbortSignal.timeout(5000),
      headers: { accept: 'application/json' },
    })
    if (!res.ok) throw new PricingCatalogUnavailableError(`models.dev returned ${res.status}`)
    return await res.json()
  } catch (err) {
    if (err instanceof PricingCatalogUnavailableError) throw err
    const message = err instanceof Error ? err.message : String(err)
    throw new PricingCatalogUnavailableError(`failed to fetch or parse models.dev catalog: ${message}`)
  }
}

export async function initializeModelPricing() {
  modelPricingStatus = { status: 'loading' }
  try {
    const result = buildModelPricingResult(await fetchModelsDevCatalog())
    if (result.entries.length === 0) {
      throw new PricingCatalogUnavailableError('models.dev response contained zero usable pricing records')
    }

    MODEL_PRICING = result.entries
    modelPricingStatus = {
      status: 'ready',
      count: result.entries.length,
      skippedRecords: result.skippedRecords,
      partialCacheRecords: result.partialCacheRecords,
    }
    console.info(
      `Loaded pricing for ${MODEL_PRICING.length} models from models.dev` +
        ` (${result.skippedRecords} skipped, ${result.partialCacheRecords} missing cache-specific rates)`,
    )
    if (result.skippedSamples.length > 0) {
      console.warn('Skipped invalid models.dev pricing records', result.skippedSamples)
    }
    if (result.partialCacheSamples.length > 0) {
      console.info('models.dev records missing cache-specific pricing', result.partialCacheSamples)
    }
  } catch (err) {
    if (!(err instanceof PricingCatalogUnavailableError)) throw err

    MODEL_PRICING = []
    modelPricingStatus = { status: 'unavailable', reason: err.message }
    console.warn('Failed to load model pricing from models.dev; request costs will be unavailable', err)
  }
}

export function resetModelPricingForTest(entries: ModelPricingEntry[] = []) {
  MODEL_PRICING = entries
  modelPricingStatus =
    entries.length > 0
      ? { status: 'ready', count: entries.length, skippedRecords: 0, partialCacheRecords: 0 }
      : { status: 'idle' }
}

export function getModelPricingStatus(): ModelPricingStatus {
  return modelPricingStatus
}

function findPricing(model: string): ModelPricing | null {
  const normalized = normalizeModel(model)
  for (const entry of MODEL_PRICING) {
    if (
      normalized === entry.model ||
      normalized.startsWith(`${entry.model}-`) ||
      normalized.startsWith(`${entry.model}[`)
    ) {
      return entry.pricing
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
  if (usage.promptTokens == null || usage.completionTokens == null) return null
  if ((usage.cacheCreationTokens ?? 0) > 0 && p.cacheWrite == null) return null
  if ((usage.cacheReadTokens ?? 0) > 0 && p.cacheRead == null) return null
  const cost =
    (usage.promptTokens * p.input +
      usage.completionTokens * p.output +
      (usage.cacheCreationTokens ?? 0) * (p.cacheWrite ?? 0) +
      (usage.cacheReadTokens ?? 0) * (p.cacheRead ?? 0)) /
    1_000_000
  return cost > 0 ? cost : null
}
