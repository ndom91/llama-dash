import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApiKey } from '../server/admin/api-keys.ts'
import { createInferenceBackend, type InferenceBackendKind } from '../server/inference/backend.ts'
import { handleProxyRequest } from '../server/proxy/handler.ts'
import { createDummyBackendState, createDummyInferenceFetch } from './fixtures/dummy-inference-backend.ts'
import { makeProxyRequest, openaiChatBody } from './fixtures/request.ts'
import { listLoggedRequests, resetTestDatabase } from './harness/db.ts'
import {
  installFakeUpstream,
  installFakeUpstreamUndiciMock,
  lastUpstreamCall,
  registerFakeUpstreamCleanup,
} from './harness/fake-upstream.ts'
import { settleProxyResponse } from './harness/proxy-request.ts'
import { undiciFetchMock } from './harness/undici-mock-state.ts'

installFakeUpstreamUndiciMock(undiciFetchMock)
registerFakeUpstreamCleanup()

const backends: InferenceBackendKind[] = ['llama-swap', 'llama-cpp-router']

describe.each(backends)('inference backend dummy: %s', (kind) => {
  const residentState = kind === 'llama-swap' ? 'ready' : 'loaded'
  const state = createDummyBackendState(kind, {
    models: kind === 'llama-swap' ? ['local-a', 'peer-claude'] : ['local-a', 'local-b'],
    running: [{ id: 'local-a', state: residentState }],
  })

  beforeEach(() => {
    resetTestDatabase()
    state.loadCalls = []
    state.unloadCalls = []
    state.unloadAllCalls = 0
    state.running = [{ id: 'local-a', state: residentState }]
    vi.stubGlobal('fetch', createDummyInferenceFetch(state))

    // Proxy forward uses undici; route local /v1 through OpenAI chat.completion shape.
    installFakeUpstream((call) => {
      const url = new URL(call.url)
      if (!url.pathname.startsWith('/v1/')) {
        return { status: 404, text: `unexpected upstream ${call.url}` }
      }
      return {
        json: {
          id: 'chatcmpl-dummy',
          object: 'chat.completion',
          created: 1_700_000_000,
          model: 'local-a',
          choices: [
            {
              index: 0,
              message: { role: 'assistant', content: 'ok' },
              finish_reason: 'stop',
              logprobs: null,
            },
          ],
          usage: { prompt_tokens: 2, completion_tokens: 1, total_tokens: 3 },
        },
      }
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('exposes the documented capability matrix', () => {
    const backend = createInferenceBackend(kind)
    expect(backend.info.kind).toBe(kind)
    if (kind === 'llama-swap') {
      expect(backend.info.capabilities).toMatchObject({ logs: true, config: true })
      expect(backend.modelConfigSnippet).toBeTypeOf('function')
    } else {
      expect(backend.info.capabilities).toMatchObject({ logs: false, config: false })
      expect(backend.modelConfigSnippet).toBeUndefined()
    }
  })

  it('lists models and running state against the dummy HTTP API', async () => {
    const backend = createInferenceBackend(kind)
    const models = await backend.listModels()
    expect(models.map((m) => m.id)).toEqual(state.models)

    if (kind === 'llama-swap') {
      const peer = models.find((m) => m.id === 'peer-claude')
      expect(peer?.kind).toBe('peer')
      expect(peer?.peerId).toBe('anthropic')
      // Official /running state for live processes is "ready"
      const running = await backend.listRunning?.()
      expect(running?.[0]?.state).toBe('ready')
    } else {
      expect(models.every((m) => m.kind === 'local' && m.peerId == null)).toBe(true)
      expect(models.every((m) => m.contextLength == null)).toBe(true)
      const running = await backend.listRunning?.()
      expect(running?.[0]?.state).toBe('loaded')
    }

    await expect(backend.getCurrentModel?.()).resolves.toBe('local-a')
  })

  it('serves official management response envelopes from the dummy', async () => {
    const fetchFn = createDummyInferenceFetch(state)
    const base = 'http://inference-dummy.test'

    if (kind === 'llama-swap') {
      expect(await (await fetchFn(`${base}/health`)).text()).toBe('OK')
      const models = await (await fetchFn(`${base}/v1/models`)).json()
      expect(models).toMatchObject({ object: 'list' })
      expect(models.data[0]).toMatchObject({ object: 'model', owned_by: 'llama-swap' })
      const running = await (await fetchFn(`${base}/running`)).json()
      expect(running.running[0].state).toBe('ready')
    } else {
      const props = await (await fetchFn(`${base}/props`)).json()
      expect(props).toMatchObject({ role: 'router', build_info: expect.stringMatching(/^b/) })
      const models = await (await fetchFn(`${base}/models`)).json()
      expect(models).toMatchObject({ object: 'list' })
      expect(models.data[0]).toMatchObject({
        object: 'model',
        owned_by: 'llamacpp',
        status: { value: 'loaded' },
      })
      const load = await (
        await fetchFn(`${base}/models/load`, {
          method: 'POST',
          body: JSON.stringify({ model: 'local-b' }),
        })
      ).json()
      expect(load).toEqual({ success: true })
    }
  })

  it('loads and unloads through the backend-specific lifecycle endpoints', async () => {
    const backend = createInferenceBackend(kind)
    await backend.loadModel?.('local-b')
    expect(state.loadCalls.at(-1)).toBe('local-b')

    await backend.unloadModel?.('local-a')
    expect(state.unloadCalls.at(-1)).toBe('local-a')

    if (kind === 'llama-swap') {
      await backend.unloadAll?.()
      expect(state.unloadAllCalls).toBe(1)
      expect(state.running).toEqual([])
    } else {
      state.running = [
        { id: 'local-a', state: 'loaded' },
        { id: 'local-b', state: 'sleeping' },
      ]
      state.unloadCalls = []
      await backend.unloadAll?.()
      expect(state.unloadCalls.sort()).toEqual(['local-a', 'local-b'])
    }
  })

  it('builds the local proxy upstream used by handleProxyRequest', async () => {
    const backend = createInferenceBackend(kind)
    // Integration env sets INFERENCE_BASE_URL=http://llama-swap.test for both kinds;
    // adapters only differ in management APIs, not the /v1 join shape.
    expect(backend.defaultProxyUpstream('/v1/chat/completions', '')).toBe('http://llama-swap.test/v1/chat/completions')

    const { rawKey } = await createApiKey({ name: `${kind}-key` })
    const response = await settleProxyResponse(
      await handleProxyRequest(
        makeProxyRequest({
          headers: { authorization: `Bearer ${rawKey}`, 'content-type': 'application/json' },
          body: openaiChatBody('local-a'),
        }),
      ),
    )
    expect(response.status).toBe(200)
    expect(lastUpstreamCall().url).toBe('http://llama-swap.test/v1/chat/completions')
    expect(listLoggedRequests()).toHaveLength(1)
  })

  it('reports reachable health from the dummy', async () => {
    const backend = createInferenceBackend(kind)
    await expect(backend.ping()).resolves.toMatchObject({ reachable: true })
    const health = await backend.health()
    expect(health.reachable).toBe(true)
    if (kind === 'llama-swap') {
      expect(health).toMatchObject({ health: 'OK', version: 'v229', commit: 'abc1234' })
    } else {
      expect(health).toMatchObject({ health: 'ok', version: 'b1234' })
    }
  })
})
