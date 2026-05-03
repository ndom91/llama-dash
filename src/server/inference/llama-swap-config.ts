import { readFileSync } from 'node:fs'
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml'
import { config } from '../config.ts'

function readParsedConfig(): unknown {
  if (!config.inferenceConfigFile) return null
  try {
    return parseYaml(readFileSync(config.inferenceConfigFile, 'utf-8'))
  } catch {
    return null
  }
}

function getConfigModels(parsed: unknown): Record<string, unknown> | null {
  if (!parsed || typeof parsed !== 'object' || !('models' in parsed)) return null
  const models = parsed.models
  return models && typeof models === 'object' ? (models as Record<string, unknown>) : null
}

function extractModelPath(value: unknown): string | null {
  const snippet = typeof value === 'string' ? value : value == null ? null : stringifyYaml(value, { indent: 2 })
  if (typeof snippet !== 'string') return null
  const match = snippet.match(/--model(?:\s+|=)(?:"([^"]+)"|'([^']+)'|(\S+))/)
  return match?.[1] ?? match?.[2] ?? match?.[3] ?? null
}

function basename(path: string): string {
  return path.split(/[\\/]/).pop() ?? path
}

export function getLlamaSwapModelLogNames(modelId: string): Array<string> {
  const models = getConfigModels(readParsedConfig())
  const modelConfig = models?.[modelId]
  if (!modelConfig) return [modelId]

  const candidates = new Set([modelId])
  const modelPath = extractModelPath(modelConfig)
  if (modelPath) {
    candidates.add(modelPath)
    candidates.add(basename(modelPath))
  }
  return [...candidates]
}

export function getLlamaSwapModelConfigSnippet(modelId: string): string | null {
  const models = getConfigModels(readParsedConfig())
  if (!models?.[modelId]) return null
  return stringifyYaml({ [modelId]: models[modelId] }, { indent: 2 })
}

export function getLlamaSwapConfigContextLengths(): Map<string, number> {
  const models = getConfigModels(readParsedConfig())
  if (!models) return new Map()

  const lengths = new Map<string, number>()
  for (const [modelId, modelConfig] of Object.entries(models)) {
    const ctxSize = extractCtxSize(modelConfig)
    if (ctxSize != null) lengths.set(modelId, ctxSize)
  }
  return lengths
}

function extractCtxSize(value: unknown): number | null {
  const snippet = typeof value === 'string' ? value : value == null ? null : stringifyYaml(value, { indent: 2 })
  if (typeof snippet !== 'string') return null
  const match = snippet.match(/--ctx-size(?:\s+|=)(\d+)/)
  return match ? Number(match[1]) : null
}
