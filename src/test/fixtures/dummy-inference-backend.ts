import type { InferenceBackendKind } from '../../server/inference/backend.ts'

export const DUMMY_INFERENCE_BASE_URL = 'http://inference-dummy.test'

/**
 * Official management + OpenAI-compatible surfaces we emulate.
 *
 * llama-swap (https://github.com/mostlygeek/llama-swap README):
 *   Management: GET /health ("OK"), GET /running, GET /upstream/:id/,
 *               POST /api/models/unload[/:id], GET /api/version (dash extension)
 *   OpenAI:     /v1/models, /v1/chat/completions, /v1/completions, /v1/embeddings,
 *               /v1/responses, /v1/audio/*, /v1/images/*, …
 *   Anthropic:  /v1/messages, /v1/messages/count_tokens
 *   /running state for live processes is "ready" (not "loaded").
 *
 * llama.cpp router (HF model-management blog + tools/server/tests/unit/test_router.py):
 *   Management: GET /models, POST /models/load|unload {model}, GET /models/sse,
 *               GET /health, GET /props (role=router, build_info)
 *   OpenAI:     /v1/chat/completions (also /chat/completions), /v1/models
 *   Load/unload JSON: {"success": true}
 *   Model status.value: loaded | loading | unloaded | sleeping
 */

export type LlamaCppRouterStatus = 'loaded' | 'loading' | 'unloaded' | 'sleeping'

export type DummyBackendState = {
  kind: InferenceBackendKind
  /** Model ids known to the dummy (listModels). */
  models: string[]
  /**
   * Currently resident models.
   * llama-swap /running only lists ready processes → use state "ready".
   * llama.cpp router uses status.value loaded|sleeping|…
   */
  running: Array<{ id: string; state: string }>
  loadCalls: string[]
  unloadCalls: string[]
  unloadAllCalls: number
}

export function createDummyBackendState(
  kind: InferenceBackendKind,
  overrides: Partial<Pick<DummyBackendState, 'models' | 'running'>> = {},
): DummyBackendState {
  const defaultRunningState = kind === 'llama-swap' ? 'ready' : 'loaded'
  return {
    kind,
    models: overrides.models ?? ['local-a', 'local-b'],
    running: overrides.running ?? [{ id: 'local-a', state: defaultRunningState }],
    loadCalls: [],
    unloadCalls: [],
    unloadAllCalls: 0,
  }
}

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status })
}

function text(body: string, status = 200): Response {
  return new Response(body, { status, headers: { 'content-type': 'text/plain' } })
}

function pathOf(input: RequestInfo | URL): string {
  const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  return new URL(raw).pathname
}

/** OpenAI chat.completion body (shared by both backends' /v1 proxy surface). */
export function openaiChatCompletionResponse(model: string) {
  return {
    id: 'chatcmpl-dummy',
    object: 'chat.completion',
    created: 1_700_000_000,
    model,
    choices: [
      {
        index: 0,
        message: { role: 'assistant', content: 'ok' },
        finish_reason: 'stop',
        logprobs: null,
      },
    ],
    usage: {
      prompt_tokens: 2,
      completion_tokens: 1,
      total_tokens: 3,
    },
  }
}

/** OpenAI-shaped GET /v1/models for llama-swap (owned_by: llama-swap, meta.llamaswap). */
export function llamaSwapModelsPayload(modelIds: string[]) {
  return {
    object: 'list' as const,
    data: modelIds.map((id, index) => ({
      id,
      object: 'model' as const,
      created: 1_700_000_000 + index,
      owned_by: 'llama-swap',
      name: id === 'peer-claude' ? 'Claude (peer)' : id,
      context_length: id === 'peer-claude' ? undefined : 8192,
      architecture:
        id === 'peer-claude'
          ? undefined
          : {
              input_modalities: ['text'],
              output_modalities: ['text'],
            },
      capabilities: id === 'peer-claude' ? undefined : { tools: true },
      supported_parameters: id === 'peer-claude' ? undefined : ['temperature'],
      meta:
        id === 'peer-claude'
          ? { llamaswap: { peerID: 'anthropic', context_length: 200_000, state: 'stopped' } }
          : {
              llamaswap: {
                state: 'ready' as const,
                ttl: 300,
                ttlRemaining: 120,
                context_length: 8192,
              },
            },
    })),
  }
}

/**
 * GET /running — only Ready processes, state string is "ready"
 * (mostlygeek/llama-swap PR #474 / proxymanager tests).
 */
export function llamaSwapRunningPayload(running: DummyBackendState['running']) {
  return {
    running: running
      .filter((m) => m.state === 'ready')
      .map((m) => ({
        model: m.id,
        name: m.id,
        description: '',
        state: 'ready' as const,
        proxy: 'http://127.0.0.1:9999',
        ttl: 300,
        cmd: `llama-server --port 9999 --model ${m.id}.gguf --ctx-size 8192`,
      })),
  }
}

/**
 * GET /models (and OAI-compat twin) — object/list + owned_by llamacpp + status.value
 * (ggml-org/llama.cpp tools/server/server-models.cpp get_router_models).
 */
export function llamaCppRouterModelsPayload(state: DummyBackendState) {
  const created = 1_700_000_000
  return {
    object: 'list' as const,
    data: state.models.map((id) => {
      const running = state.running.find((m) => m.id === id)
      const statusValue = (running?.state ?? 'unloaded') as LlamaCppRouterStatus
      return {
        id,
        aliases: [] as string[],
        tags: id.includes('vision') ? ['vision'] : ['text'],
        object: 'model' as const,
        owned_by: 'llamacpp',
        created,
        status: {
          value: statusValue,
          args: [] as string[],
        },
      }
    }),
  }
}

/**
 * Path-dispatching dummy HTTP handler for one inference backend kind.
 * Use with `vi.stubGlobal('fetch', …)` (adapters) or undici mocks (proxy).
 */
export function createDummyInferenceFetch(state: DummyBackendState) {
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const path = pathOf(input)
    const method = (init?.method ?? 'GET').toUpperCase()

    if (state.kind === 'llama-swap') {
      // README: /health just returns "OK"
      if (path === '/health' && method === 'GET') return text('OK')
      if (path === '/api/version' && method === 'GET') {
        return json({ version: 'v229', commit: 'abc1234', build_date: '2026-01-01' })
      }
      if (path === '/v1/models' && method === 'GET') return json(llamaSwapModelsPayload(state.models))
      if (path === '/running' && method === 'GET') return json(llamaSwapRunningPayload(state.running))
      // Side-effect load via direct upstream probe
      if (path.startsWith('/upstream/') && (method === 'GET' || method === 'POST')) {
        const id = decodeURIComponent(path.slice('/upstream/'.length).replace(/\/$/, ''))
        state.loadCalls.push(id)
        if (!state.running.some((m) => m.id === id && m.state === 'ready')) {
          state.running = state.running.filter((m) => m.id !== id)
          state.running.push({ id, state: 'ready' })
        }
        return text('OK')
      }
      if (path.startsWith('/api/models/unload/') && method === 'POST') {
        const id = decodeURIComponent(path.slice('/api/models/unload/'.length))
        state.unloadCalls.push(id)
        state.running = state.running.filter((m) => m.id !== id)
        return text('OK')
      }
      if (path === '/api/models/unload' && method === 'POST') {
        state.unloadAllCalls++
        state.running = []
        return json({ msg: 'ok' })
      }
      if (isOpenAiCompatibleInferencePath(path) && method === 'POST') {
        const model = parseRequestedModel(init?.body) ?? state.running[0]?.id ?? 'local-a'
        return json(openaiChatCompletionResponse(model))
      }
      return text(`llama-swap dummy: unhandled ${method} ${path}`, 404)
    }

    // llama.cpp router
    if (path === '/health' && method === 'GET') return text('ok')
    if (path === '/props' && method === 'GET') {
      // tools/server/tests/unit/test_router.py::test_router_props
      return json({
        role: 'router',
        max_instances: 4,
        models_autoload: true,
        build_info: 'b1234-dummy',
        version: 'b1234',
      })
    }
    // Management list + OAI-compat alias both return the same catalog shape
    if ((path === '/models' || path === '/v1/models') && method === 'GET') {
      return json(llamaCppRouterModelsPayload(state))
    }
    if (path === '/models/load' && method === 'POST') {
      const id = String(parseRequestedModel(init?.body) ?? '')
      state.loadCalls.push(id)
      state.running = state.running.filter((m) => m.id !== id)
      state.running.push({ id, state: 'loaded' })
      return json({ success: true })
    }
    if (path === '/models/unload' && method === 'POST') {
      const id = String(parseRequestedModel(init?.body) ?? '')
      state.unloadCalls.push(id)
      state.running = state.running.filter((m) => m.id !== id)
      return json({ success: true })
    }
    if (isOpenAiCompatibleInferencePath(path) && method === 'POST') {
      const model = parseRequestedModel(init?.body) ?? state.running.find((m) => m.state === 'loaded')?.id ?? 'local-a'
      return json(openaiChatCompletionResponse(model))
    }
    return text(`llama.cpp router dummy: unhandled ${method} ${path}`, 404)
  }
}

/** Paths both backends expose for OpenAI-compatible inference (README / router tests). */
export function isOpenAiCompatibleInferencePath(path: string): boolean {
  return (
    path === '/v1/chat/completions' ||
    path === '/chat/completions' ||
    path === '/v1/completions' ||
    path === '/v1/embeddings' ||
    path === '/v1/responses' ||
    path === '/v1/messages' ||
    path === '/v1/messages/count_tokens'
  )
}

function parseRequestedModel(body: BodyInit | null | undefined): string | null {
  if (body == null || typeof body !== 'string') return null
  try {
    const parsed = JSON.parse(body) as { model?: unknown }
    return typeof parsed.model === 'string' ? parsed.model : null
  } catch {
    return null
  }
}
