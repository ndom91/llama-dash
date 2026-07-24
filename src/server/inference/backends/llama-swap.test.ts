import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createLlamaSwapBackend } from './llama-swap.ts'

const llamaSwapMock = vi.hoisted(() => ({
  health: vi.fn(async () => 'OK'),
  version: vi.fn(async () => ({ version: 'v229', commit: 'abc', build_date: '2026-01-01' })),
  listModels: vi.fn(async () => ({ object: 'list' as const, data: [] as unknown[] })),
  listRunning: vi.fn(async () => ({ running: [] as unknown[] })),
  loadModel: vi.fn(async () => 'ok'),
  unloadModel: vi.fn(async () => 'ok'),
  unloadAll: vi.fn(async () => ({ msg: 'ok' })),
}))

vi.mock('../../config.ts', () => ({
  config: {
    inferenceBackend: 'llama-swap',
    inferenceBaseUrl: 'http://llama-swap.dummy',
    inferenceInsecure: false,
    inferenceConfigFile: '',
    databasePath: ':memory:',
    credentialEncryptionKey: 'x'.repeat(32),
  },
}))

vi.mock('../../llama-swap/client.ts', () => ({
  llamaSwap: llamaSwapMock,
}))

vi.mock('../llama-swap-config.ts', () => ({
  getLlamaSwapModelLogNames: (id: string) => [`${id}.log`],
  getLlamaSwapModelConfigSnippet: (id: string) => `models:\n  ${id}: {}`,
  getLlamaSwapConfigContextLengths: () => new Map([['local-a', 8192]]),
}))

describe('createLlamaSwapBackend', () => {
  const backend = createLlamaSwapBackend()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('advertises full llama-swap capabilities', () => {
    expect(backend.info).toMatchObject({
      kind: 'llama-swap',
      label: 'llama-swap',
      upstreamBaseUrl: 'http://llama-swap.dummy',
      upstreamHost: 'llama-swap.dummy',
      capabilities: {
        models: true,
        runningModels: true,
        lifecycle: true,
        logs: true,
        config: true,
        metrics: true,
      },
    })
  })

  it('maps local and peer models with context and capability flags', async () => {
    llamaSwapMock.listModels.mockResolvedValueOnce({
      object: 'list',
      data: [
        {
          id: 'local-a',
          object: 'model',
          created: 1,
          owned_by: 'local',
          name: 'Local A',
          context_length: 8192,
          architecture: { input_modalities: ['text'], output_modalities: ['text'] },
          capabilities: { tools: true, vision: false },
          supported_parameters: ['temperature'],
        },
        {
          id: 'claude-sonnet',
          object: 'model',
          created: 1,
          owned_by: 'peer',
          meta: { llamaswap: { peerID: 'anthropic', context_length: 200_000 } },
        },
      ],
    })

    await expect(backend.listModels()).resolves.toEqual([
      {
        id: 'local-a',
        name: 'Local A',
        kind: 'local',
        peerId: null,
        contextLength: 8192,
        capabilities: {
          inputModalities: ['text'],
          outputModalities: ['text'],
          flags: ['tools'],
          supportedParameters: ['temperature'],
        },
      },
      {
        id: 'claude-sonnet',
        name: 'claude-sonnet',
        kind: 'peer',
        peerId: 'anthropic',
        contextLength: 200_000,
        capabilities: {
          inputModalities: [],
          outputModalities: [],
          flags: [],
          supportedParameters: [],
        },
      },
    ])
  })

  it('maps running models and extracts --ctx-size from cmd', async () => {
    llamaSwapMock.listRunning.mockResolvedValueOnce({
      running: [
        {
          model: 'local-a',
          name: 'local-a',
          description: '',
          state: 'ready',
          proxy: 'http://127.0.0.1:1',
          ttl: 60,
          cmd: 'llama-server --model a.gguf --ctx-size 16384',
        },
      ],
    })

    await expect(backend.listRunning?.()).resolves.toEqual([
      { model: 'local-a', state: 'ready', ttl: 60, contextLength: 16384 },
    ])
  })

  it('returns the first ready model as current', async () => {
    llamaSwapMock.listRunning.mockResolvedValueOnce({
      running: [
        {
          model: 'local-a',
          name: 'local-a',
          description: '',
          state: 'ready',
          proxy: 'http://127.0.0.1:1',
          ttl: 60,
          cmd: '',
        },
      ],
    })

    await expect(backend.getCurrentModel?.()).resolves.toBe('local-a')
  })

  it('pings and reports health from the llama-swap client', async () => {
    await expect(backend.ping()).resolves.toMatchObject({ reachable: true })
    await expect(backend.health()).resolves.toMatchObject({
      reachable: true,
      health: 'OK',
      version: 'v229',
      commit: 'abc',
    })
  })

  it('delegates lifecycle actions to the client', async () => {
    await backend.loadModel?.('local-a')
    await backend.unloadModel?.('local-a')
    await backend.unloadAll?.()
    expect(llamaSwapMock.loadModel).toHaveBeenCalledWith('local-a')
    expect(llamaSwapMock.unloadModel).toHaveBeenCalledWith('local-a')
    expect(llamaSwapMock.unloadAll).toHaveBeenCalledOnce()
  })
})
