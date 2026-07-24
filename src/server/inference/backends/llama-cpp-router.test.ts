import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createDummyBackendState,
  createDummyInferenceFetch,
  DUMMY_INFERENCE_BASE_URL,
} from '../../../test/fixtures/dummy-inference-backend.ts'
import { createLlamaCppRouterBackend } from './llama-cpp-router.ts'

vi.mock('../../config.ts', () => ({
  config: {
    inferenceBackend: 'llama-cpp-router',
    inferenceBaseUrl: DUMMY_INFERENCE_BASE_URL,
    inferenceInsecure: false,
    inferenceConfigFile: '',
    databasePath: ':memory:',
    credentialEncryptionKey: 'x'.repeat(32),
  },
}))

describe('createLlamaCppRouterBackend', () => {
  const state = createDummyBackendState('llama-cpp-router', {
    models: ['local-a', 'vision-b', 'local-c'],
    running: [
      { id: 'local-a', state: 'loaded' },
      { id: 'vision-b', state: 'sleeping' },
    ],
  })
  const backend = createLlamaCppRouterBackend()

  beforeEach(() => {
    state.loadCalls = []
    state.unloadCalls = []
    state.running = [
      { id: 'local-a', state: 'loaded' },
      { id: 'vision-b', state: 'sleeping' },
    ]
    vi.stubGlobal('fetch', createDummyInferenceFetch(state))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('advertises router capabilities without logs or config', () => {
    expect(backend.info).toMatchObject({
      kind: 'llama-cpp-router',
      label: 'llama.cpp Router',
      upstreamBaseUrl: DUMMY_INFERENCE_BASE_URL,
      capabilities: {
        models: true,
        runningModels: true,
        lifecycle: true,
        logs: false,
        config: false,
        metrics: true,
      },
    })
    expect(backend.modelConfigSnippet).toBeUndefined()
    expect(backend.modelLogNames).toBeUndefined()
  })

  it('lists models from /models with tags as flags and no peers', async () => {
    const models = await backend.listModels()
    expect(models).toEqual([
      {
        id: 'local-a',
        name: 'local-a',
        kind: 'local',
        peerId: null,
        contextLength: null,
        capabilities: {
          inputModalities: ['text'],
          outputModalities: ['text'],
          flags: ['text'],
          supportedParameters: [],
        },
      },
      {
        id: 'vision-b',
        name: 'vision-b',
        kind: 'local',
        peerId: null,
        contextLength: null,
        capabilities: {
          inputModalities: ['text'],
          outputModalities: ['text'],
          flags: ['vision'],
          supportedParameters: [],
        },
      },
      {
        id: 'local-c',
        name: 'local-c',
        kind: 'local',
        peerId: null,
        contextLength: null,
        capabilities: {
          inputModalities: ['text'],
          outputModalities: ['text'],
          flags: ['text'],
          supportedParameters: [],
        },
      },
    ])
  })

  it('treats loaded and sleeping as running, but current model is loaded-only', async () => {
    await expect(backend.listRunning?.()).resolves.toEqual([
      { model: 'local-a', state: 'loaded', ttl: null, contextLength: null },
      { model: 'vision-b', state: 'sleeping', ttl: null, contextLength: null },
    ])
    await expect(backend.getCurrentModel?.()).resolves.toBe('local-a')
  })

  it('loads and unloads via POST /models/load and /models/unload', async () => {
    await backend.loadModel?.('local-c')
    expect(state.loadCalls).toEqual(['local-c'])
    expect(state.running.some((m) => m.id === 'local-c' && m.state === 'loaded')).toBe(true)

    await backend.unloadModel?.('local-a')
    expect(state.unloadCalls).toEqual(['local-a'])
    expect(state.running.some((m) => m.id === 'local-a')).toBe(false)
  })

  it('unloadAll fans out unload calls for loaded and sleeping models', async () => {
    await backend.unloadAll?.()
    expect(state.unloadCalls.sort()).toEqual(['local-a', 'vision-b'])
    expect(state.running).toEqual([])
  })

  it('reports health from /health and /props version fields', async () => {
    await expect(backend.ping()).resolves.toMatchObject({ reachable: true })
    await expect(backend.health()).resolves.toMatchObject({
      reachable: true,
      health: 'ok',
      version: 'b1234',
    })
  })

  it('returns {success:true} from load/unload and OAI-compat /v1/models catalog fields', async () => {
    const loadRes = await fetch(`${DUMMY_INFERENCE_BASE_URL}/models/load`, {
      method: 'POST',
      body: JSON.stringify({ model: 'local-c' }),
    })
    await expect(loadRes.json()).resolves.toEqual({ success: true })

    const catalog = await (await fetch(`${DUMMY_INFERENCE_BASE_URL}/v1/models`)).json()
    expect(catalog.object).toBe('list')
    expect(catalog.data[0]).toMatchObject({
      object: 'model',
      owned_by: 'llamacpp',
      status: expect.objectContaining({ value: expect.any(String) }),
    })
  })
})
