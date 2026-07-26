import { describe, expect, it, vi } from 'vitest'
import { createInferenceBackend } from './backend.ts'
import { createLlamaCppRouterBackend } from './backends/llama-cpp-router.ts'
import { createLlamaSwapBackend } from './backends/llama-swap.ts'

vi.mock('../config.ts', () => ({
  config: {
    inferenceBackend: 'llama-swap',
    inferenceBaseUrl: 'http://inference-dummy.test',
    inferenceInsecure: false,
    inferenceConfigFile: '',
    databasePath: ':memory:',
    credentialEncryptionKey: 'x'.repeat(32),
  },
}))

describe('createInferenceBackend', () => {
  it('builds the llama-swap adapter', () => {
    const backend = createInferenceBackend('llama-swap')
    expect(backend.info.kind).toBe('llama-swap')
    expect(backend.info.capabilities).toEqual({
      models: true,
      runningModels: true,
      lifecycle: true,
      logs: true,
      config: true,
      metrics: true,
    })
    expect(backend.eventStreamUrl).toBe('http://inference-dummy.test/api/events')
    expect(backend.modelConfigSnippet).toBeTypeOf('function')
  })

  it('builds the llama.cpp router adapter', () => {
    const backend = createInferenceBackend('llama-cpp-router')
    expect(backend.info.kind).toBe('llama-cpp-router')
    expect(backend.info.label).toBe('llama.cpp Router')
    expect(backend.info.capabilities).toEqual({
      models: true,
      runningModels: true,
      lifecycle: true,
      logs: false,
      config: false,
      metrics: true,
    })
    expect(backend.eventStreamUrl).toBe('http://inference-dummy.test/models/sse')
    expect(backend.modelConfigSnippet).toBeUndefined()
  })

  it('rejects unknown backend kinds', () => {
    expect(() => createInferenceBackend('ollama')).toThrow(/Unsupported INFERENCE_BACKEND "ollama"/)
  })

  it('uses the same defaultProxyUpstream shape for both backends', () => {
    for (const factory of [createLlamaSwapBackend, createLlamaCppRouterBackend]) {
      const backend = factory()
      expect(backend.defaultProxyUpstream('/v1/chat/completions', '?n=1')).toBe(
        'http://inference-dummy.test/v1/chat/completions?n=1',
      )
    }
  })
})
