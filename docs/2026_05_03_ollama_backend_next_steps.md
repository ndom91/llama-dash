# Ollama Backend Next Steps

Date: 2026-05-03

## Current State

The initial inference backend abstraction is in place.

Completed foundation:

- `INFERENCE_*` env vars replace the old llama-swap-specific env interface.
- `inferenceBackend` is selected through a small backend factory.
- The concrete llama-swap backend lives in `src/server/inference/backends/llama-swap.ts`.
- Backend model/running-model data is normalized before admin routes consume it.
- Proxy default upstream resolution goes through the selected backend.
- Backend capability flags are surfaced through `/api/system`.
- Sidebar hides config/log links when unsupported.
- Direct `/config` and `/logs` navigation has fallback UI.
- `/logs` no longer mounts the llama-swap SSE hook before backend capability status is known.
- Config/log/model-detail llama-swap specifics are contained behind backend hints or llama-swap-specific files.

The only implemented backend is still `llama-swap`.

## Recommended Next Step

Do not add more abstract machinery before testing a second backend. The next
meaningful step is to add a small, read-only Ollama backend spike behind:

```text
INFERENCE_BACKEND=ollama
```

Before that, do one small UI cleanup:

```text
Audit and hide model lifecycle controls when capabilities.lifecycle is false.
```

This avoids a bad first Ollama UX where the Models page lists Ollama models but
still shows llama-swap-style load/unload controls.

## Ollama Backend Scope

Keep the first Ollama pass deliberately narrow.

Implement:

- health/ping
- list available models
- list running models
- `/v1/*` proxy forwarding through Ollama's OpenAI-compatible API
- conservative capability flags

Do not implement yet:

- model pull/delete
- load/unload lifecycle controls
- config editing
- runtime log streaming
- Docker/container management

## Files To Add

Likely new files:

```text
src/server/ollama/schemas.ts
src/server/ollama/client.ts
src/server/inference/backends/ollama.ts
```

Update:

```text
src/server/inference/backend.ts
```

Expected registry shape:

```ts
type InferenceBackendKind = 'llama-swap' | 'ollama'

function createInferenceBackend(kind: string): InferenceBackend {
  if (kind === 'llama-swap') return createLlamaSwapBackend()
  if (kind === 'ollama') return createOllamaBackend()
  throw new Error(`Unsupported INFERENCE_BACKEND "${kind}". Supported backends: llama-swap, ollama`)
}
```

## Ollama Endpoint Mapping

Initial endpoint mapping to verify against the installed Ollama version:

```text
GET /api/tags
  -> list available models

GET /api/ps
  -> list loaded/running models

GET /api/version or GET /
  -> health/ping

/v1/*
  -> OpenAI-compatible proxy forwarding
```

Potential model fields from `/api/tags`:

- `name`
- `model`
- `modified_at`
- `size`
- `details.family`
- `details.parameter_size`
- `details.quantization_level`

Initial normalized model mapping can be conservative:

```ts
{
  id: model.name,
  name: model.name,
  kind: 'local',
  peerId: null,
  contextLength: null,
}
```

Initial running model mapping from `/api/ps`:

```ts
{
  model: model.name,
  state: 'running',
  ttl: null,
  contextLength: null,
}
```

If Ollama exposes an `expires_at` value, we can later derive a TTL label from
that, but it is not required for the first pass.

## Initial Ollama Capabilities

Start with:

```text
models: true
runningModels: true
lifecycle: false
logs: false
config: false
metrics: false
```

Revisit lifecycle after the read-only backend works. Ollama lifecycle semantics
are demand-driven through requests and `keep_alive`, not the same explicit
load/unload model as llama-swap.

## Expected UI Behavior

With `INFERENCE_BACKEND=ollama`:

- Dashboard should load.
- System should show `ollama`.
- Sidebar should hide Logs and Config.
- Direct `/logs` should show unsupported fallback without opening `/api/events`.
- Direct `/config` should show unsupported fallback.
- Models page should list Ollama models.
- Running models should show if `/api/ps` reports loaded models.
- Load/unload controls should be hidden or disabled because lifecycle is unsupported.
- Requests should log when clients call llama-dash `/v1/*` and llama-dash forwards to Ollama `/v1/*`.

## Validation Checklist

After implementing the lifecycle-control UI cleanup and the first Ollama backend:

```bash
pnpm lint:fix
pnpm format:fix
pnpm typecheck
pnpm test
```

Manual smoke checks:

- `INFERENCE_BACKEND=llama-swap` still behaves as before.
- `INFERENCE_BACKEND=ollama` starts when pointed at a reachable Ollama server.
- `INFERENCE_BACKEND=bad-value` fails loudly at startup.
- `/api/system` reports the selected backend and capabilities.
- `/api/models` returns normalized model rows for both backends.
- `/v1/chat/completions` through llama-dash logs a request for both backends.

## Notes

The abstraction should remain capability-driven. Avoid faking unsupported
features for Ollama just to keep existing llama-swap UI visible.

If adding Ollama reveals friction, prefer adjusting the backend facade around
real Ollama behavior instead of adding speculative generic abstractions.
