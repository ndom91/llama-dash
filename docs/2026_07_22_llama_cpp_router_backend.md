# llama.cpp Router Backend

Date: 2026-07-22

## Summary

llama-dash gained a second concrete inference backend:
`INFERENCE_BACKEND=llama-cpp-router`. It fronts a host-run
[`llama-server`](https://github.com/ggml-org/llama.cpp) process in **router
mode** (model directory + load/unload API), without bundling llama-swap or
exposing a config editor.

This is the first non-llama-swap adapter behind the capability-driven facade
described in [`2026_05_03_inference_backends.md`](./2026_05_03_inference_backends.md).

Shipped in:

| Commit | What |
|--------|------|
| `c654b00` | Initial adapter, env docs, `docker-compose.router.yaml`, AGENTS/README |
| `ab7fab7` | Health/props version probing (`build_info`) + `/api/health` payload cleanup |

Later queue work (`getCurrentModel()` on the adapter, model-watcher idle
notify) builds on this backend but is documented separately in
[`2026_07_23_concurrent_queue_model_grouping.md`](./2026_07_23_concurrent_queue_model_grouping.md).

## Why this backend

llama-swap remains the default full-feature path (config editor, log streams,
peers, YAML hot-reload). Some operators already run `llama-server` directly in
router mode and only need llama-dash for:

- `/v1/*` proxy policy, auth, logging, routing
- Models UI load/unload against the router's REST API
- Dashboard/GPU/request observability

Router mode fills that gap without requiring a llama-swap `config.yaml`.

## Runtime configuration

```text
INFERENCE_BACKEND=llama-cpp-router
INFERENCE_BASE_URL=http://localhost:8080   # or host.docker.internal from compose
INFERENCE_INSECURE=false                   # only if TLS to the router
```

`INFERENCE_CONFIG_FILE` is ignored for this backend (`capabilities.config =
false`). Unsupported `INFERENCE_BACKEND` values still fail at process start.

Factory selection lives in `src/server/inference/backend.ts`:

```ts
if (kind === 'llama-swap') return createLlamaSwapBackend()
if (kind === 'llama-cpp-router') return createLlamaCppRouterBackend()
```

## Compose packaging

[`docker-compose.router.yaml`](../docker-compose.router.yaml) runs **only**
llama-dash and points it at a host `llama-server`:

```bash
# Host
llama-server --models-dir ./models --port 8080 --host 0.0.0.0

# Container
docker compose -f docker-compose.router.yaml up -d
```

Compose forces:

```text
INFERENCE_BACKEND=llama-cpp-router
INFERENCE_BASE_URL=http://host.docker.internal:8080
```

plus `extra_hosts: host.docker.internal:host-gateway` so Linux Docker can reach
the host. AMD/NVIDIA compose files remain llama-swap bundles.

## Capability matrix

| Capability | llama-swap | llama-cpp-router |
|------------|------------|------------------|
| `models` | yes | yes (`GET /models`) |
| `runningModels` | yes (`GET /running`) | yes (filter `/models` by status) |
| `lifecycle` | yes | yes (`POST /models/load`, `/models/unload`) |
| `logs` | yes (SSE streams) | **no** — sidebar/Logs page fall back |
| `config` | yes when `INFERENCE_CONFIG_FILE` set | **no** — Config page unavailable (`501`) |
| `metrics` | yes | yes (proxy `/metrics` path still works via upstream) |
| peers / YAML aliases | yes | **no** — all models are `kind: 'local'` |
| context length hints | from config | always `null` today |
| event stream URL | llama-swap logs | `GET /models/sse` advertised on the adapter |

UI and admin behavior stay capability-driven:

- Sidebar hides Logs/Config when unsupported.
- `/api/config*` returns `501` when `capabilities.config` is false.
- Models load/unload use the adapter methods when present.

## Adapter surface

Implementation: `src/server/inference/backends/llama-cpp-router.ts`.

### Upstream HTTP used

| llama.cpp router | llama-dash use |
|------------------|----------------|
| `GET /health` | `ping()`, `health()` latency + raw body |
| `GET /props` | optional version / `build_info` / `router_version` |
| `GET /models` | `listModels()`, `listRunning()`, `getCurrentModel()` |
| `POST /models/load` `{ model }` | `loadModel(id)` |
| `POST /models/unload` `{ model }` | `unloadModel(id)`, and each step of `unloadAll()` |
| `GET /models/sse` | `eventStreamUrl` (admin model events path when used) |
| `/v1/*` (and other paths) | proxy via `defaultProxyUpstream` → `INFERENCE_BASE_URL` |

There is no bulk unload endpoint; `unloadAll()` lists loaded/sleeping models and
unloads them with `Promise.allSettled` (best-effort).

### Status mapping

Router model entries expose `status.value`. llama-dash treats:

- `loaded` and `sleeping` → present in `listRunning()`
- `loaded` only → `getCurrentModel()` (scheduler preference when idle)

Normalized shapes match the shared facade (`BackendModel`,
`BackendRunningModel`). Context length and TTL are not populated from the
router API yet (`null`). Capability flags on listed models come from router
`tags` when present; modalities default to text in/out.

### Health quirks

Router `/health` may return a non-JSON body. The adapter keeps it as a trimmed
string. Version is best-effort from `/props` (`version` → `build_info` →
`router_version`). `/api/health` only includes version fields when present so
clients do not see `null` noise.

## What stays the same

Regardless of backend:

- Dashboard auth, API keys, routing rules, direct upstreams, MCP relays
- `/v1/*` proxy transforms, logging, rate limits
- Local-backend concurrency queue (router traffic is local; direct upstreams
  still bypass)

Proxy forwarding does not special-case the router beyond
`defaultProxyUpstream()`.

## Gaps and non-goals

Still true for router mode:

- No config editor / YAML round-trip — manage models via Models UI or router API.
- No llama-swap-style log multiplexing (`/api/log-events` remains llama-swap-oriented).
- No peer models or llama-swap `peers:` Anthropic passthrough via this backend;
  use llama-dash **direct** routing rules for cloud providers instead.
- No valibot schemas for router JSON yet — responses are lightly typed in the
  adapter. Tightening validation would match the llama-swap client pattern.
- Context length / richer capability metadata from the router is not scraped yet.
- `eventStreamUrl` is set to `/models/sse`; confirm product use before relying on
  it for dashboard invalidation (model-watcher still polls `listRunning()`).

## Operator checklist

1. Run `llama-server` with a models directory and listen address reachable from
   llama-dash.
2. Set `INFERENCE_BACKEND=llama-cpp-router` and `INFERENCE_BASE_URL`.
3. Or use `docker-compose.router.yaml` and keep the host router on `:8080`.
4. Open Models — list/load/unload should work; Config/Logs should be hidden or
   show unsupported fallbacks.
5. Point clients at llama-dash `/v1/*` as usual.

## Related docs

- [`2026_05_03_inference_backends.md`](./2026_05_03_inference_backends.md) — facade design
- [`2026_05_03_ollama_backend_next_steps.md`](./2026_05_03_ollama_backend_next_steps.md) — next candidate backend (still parked)
- [`2026_07_23_concurrent_queue_model_grouping.md`](./2026_07_23_concurrent_queue_model_grouping.md) — local concurrency + `getCurrentModel`
