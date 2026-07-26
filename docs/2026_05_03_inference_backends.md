# Inference Backends

Date: 2026-05-03

## Summary

llama-dash has an inference backend facade between the dashboard/proxy code
and the concrete inference runtime. Two backends are implemented:

- `llama-swap` — default, full feature set (config editor, log streams, peers).
- `llama-cpp-router` — host `llama-server` router mode (model list, load/unload,
  health; no config editor or log streams). See
  [`2026_07_22_llama_cpp_router_backend.md`](./2026_07_22_llama_cpp_router_backend.md).

Ollama remains a parked candidate; see
[`2026_05_03_ollama_backend_next_steps.md`](./2026_05_03_ollama_backend_next_steps.md).

The current product stance is:

- llama-swap/llama.cpp remains the default local GGUF runtime path when you want
  bundled compose + config editing.
- llama.cpp router mode is the alternate local path when `llama-server` already
  owns model processes.
- vLLM is not being pursued as the primary homelab runtime path right now.
- Ollama is the next likely additional backend candidate, but implementation is
  parked until needed.

## Runtime Configuration

The active backend is configured with generic inference environment variables:

```text
INFERENCE_BACKEND=llama-swap
INFERENCE_BASE_URL=http://localhost:8080
INFERENCE_INSECURE=false
INFERENCE_CONFIG_FILE=/path/to/config.yaml
```

Supported values: `llama-swap` (default) and `llama-cpp-router`. Unsupported
values fail at startup instead of silently using the wrong runtime.

`INFERENCE_CONFIG_FILE` is optional and only meaningful for llama-swap. For
llama-swap, it enables the config editor and config-derived hints such as
context lengths and model log-name matching. If it is unset, llama-swap still
works as the inference backend, but the config editor reports that the config
file path is not configured. Router mode ignores it (`capabilities.config =
false`).

## Facade Shape

The selected backend is exposed as `inferenceBackend` from
`src/server/inference/backend.ts`.

Core methods:

```ts
info
ping()
health()
defaultProxyUpstream(pathname, search)
listModels()
```

Optional capabilities:

```ts
listRunning?()
loadModel?()
unloadModel?()
unloadAll?()
modelLogNames?()
modelConfigSnippet?()
modelContextLengthHints?()
eventStreamUrl?
```

Backend capability flags are surfaced through `/api/system` and drive UI
behavior. For example, unsupported logs/config capabilities hide the sidebar
links and show fallback UIs on direct navigation.

## Normalized Model Data

Backend model APIs return normalized shapes instead of raw llama-swap responses:

```ts
type BackendModel = {
  id: string
  name: string
  kind: 'local' | 'peer'
  peerId: string | null
  contextLength: number | null
}

type BackendRunningModel = {
  model: string
  state: string
  ttl: number | null
  contextLength: number | null
}
```

The admin model routes and model detail builder consume these normalized shapes.
Runtime-specific response metadata stays inside the backend adapter.

## Capability Behavior

The abstraction is intentionally capability-based rather than pretending all
runtimes can do everything llama-swap can do.

llama-swap capabilities:

```text
models: supported
runningModels: supported
lifecycle: supported
logs: supported
config: supported when INFERENCE_CONFIG_FILE is set for actual reads/writes
metrics: supported
```

llama-cpp-router capabilities:

```text
models: supported
runningModels: supported
lifecycle: supported
logs: unsupported
config: unsupported
metrics: supported
```

For any backend, unsupported operations should return a structured `501`
from the admin API rather than throwing generic errors. UI entrypoints should
either hide unsupported links or show a direct-navigation fallback.

## llama-swap Specifics

llama-swap-specific behavior lives in these areas:

```text
src/server/llama-swap/*
src/server/inference/llama-swap-config.ts
src/server/admin/config.ts
src/features/logs/LogsPage.tsx, only mounted when logs are supported
src/features/config/ConfigPage.tsx, only useful when config is supported/configured
```

The config editor still validates against llama-swap's published config schema.
That is acceptable because llama-swap is the only backend with config editing
support right now. If another backend grows config editing, validation should
move behind a backend-specific config capability.

## Singleton vs Registry

The current implementation uses a selected singleton:

```ts
export const inferenceBackend = ...
```

This is appropriate while llama-dash has one active inference backend per
process. A factory selects among implemented adapters (`llama-swap`,
`llama-cpp-router`).

A registry becomes useful when llama-dash supports multiple active runtimes at
the same time. Until then, a registry would add indirection without behavior.

## Adding Ollama Later

The likely Ollama implementation should add:

```text
src/server/ollama/client.ts
src/server/ollama/schemas.ts
src/server/inference/ollama-backend.ts
```

Initial Ollama mappings to investigate:

```text
GET /api/tags      -> list available models
GET /api/ps        -> list running/loaded models
POST /api/show     -> model details
/v1/*              -> OpenAI-compatible proxy forwarding
```

Expected capability differences:

- Model listing should be supported.
- Running model detection should likely be supported through `/api/ps`.
- Lifecycle semantics differ because Ollama loads on demand and unloads through
  keep-alive behavior rather than llama-swap-style explicit process control.
- Runtime log streaming is not expected to be supported through the standard
  Ollama HTTP API.
- Config editing is not expected to map cleanly to the current llama-swap config
  editor.

## Current Non-Goals

- Do not replace llama-swap/llama.cpp as the default local GGUF runtime.
- Do not implement vLLM runtime management as part of this abstraction pass.
- Do not build a generic Docker control plane until there is a concrete runtime
  that needs it.
- Do not fake unsupported backend capabilities just to keep UI sections visible.
