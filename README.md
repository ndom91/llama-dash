<h1>
  <img src="./public/favicon.svg" alt="" width="42" align="left" />
  &nbsp;llama-dash
</h1>

<img alt="Dark - Dashboard" src="./.github/assets/dashboard.png" />

llama-dash turns a self-hosted local inference box into an observable, policy-controlled AI gateway: one UI for model state, request history, API keys, routing rules, proxy metrics, and client setup. The implemented inference backend is currently [llama-swap](https://github.com/mostlygeek/llama-swap) over llama.cpp.

It is the single public entrypoint for OpenAI-compatible and Anthropic-compatible clients. llama-dash owns proxy policy, logging, auth, routing, and backend normalization; the selected inference backend owns local model processes and inference when traffic is routed to local models.

```text
OpenAI SDK / Claude Code / Continue / Open WebUI
                    │
                    ▼
              llama-dash :3000
      dashboard · auth · logs · routing · metrics
             │                     │
             ▼                     ▼
      llama-swap :8080         direct /v1 upstreams
  llama.cpp models · peers      OpenAI · Anthropic
```

## ✨ What it does

- **Dashboard** — live stats, sparklines, model timeline, upstream health, GPU monitoring.
- **Model management** — load/unload models, per-model stats, load history, config snippet.
- **Request logging** — every completed `/v1/*` call is queued for SQLite logging with searchable UI, histogram, and detail view.
- **Transparent proxy** — streaming SSE preserved, bounded body capture for logs, token counts scraped in-flight. OpenAI (`/v1/chat/completions`) and Anthropic (`/v1/messages`) shapes both supported — for example, point Claude Code at llama-dash via `ANTHROPIC_BASE_URL` to proxy and track your Claude code usage as well.
- **API keys** — per-key rate limits (RPM/TPM), model allow-lists editable from detail page, hashed at rest, per-key stats and model usage breakdown.
- **Dashboard auth** — Better Auth username/password and passkey session gate for the UI and `/api/*` with first-visit signup; `/v1/*` proxy auth stays API-key based.
- **Policies** — custom routing rules with real proxy enforcement for continue, model rewrite, and policy reject actions, plus explicit auth passthrough and direct HTTPS `/v1` upstream targets for bearer/OAuth flows, per-key system prompt injection, and global request size limits.
- **Attribution** — configurable header mapping for client, end-user, and session metadata with setup examples for common clients.
- **Request auditing** — per-key usage tracking across all proxied calls.
- **Prometheus metrics** — `/metrics` exposes proxy request, token, latency-window, queue, upstream, running-model, and GPU gauges.
- **GPU monitoring** — NVIDIA, AMD, and Apple Silicon. VRAM, utilization, temp, power.
- **Config editor** — edit llama-swap `config.yaml` in-browser with on-demand validation, enforced pre-save schema checks, and auto-reload.
- **Inference backend facade** — backend health, model list/running state, lifecycle actions, logs, and config are capability-driven so future runtimes can be added without weakening the llama-swap experience.
- **Endpoints** — copyable base URL, API key selector, code examples for curl, Python, TypeScript, Home Assistant, Claude Code, opencode, Open WebUI, and more.
- **Playground** — supports chat, image, speech and transcribe.

## 🎯 Use cases

- Give teammates API keys without exposing llama-swap directly on your network.
- See which models are running, which clients are using them, and where latency is coming from.
- Debug slow or failed requests with status, token usage, timing, routing, attribution, and upstream metadata in one place.
- Enforce model allow-lists, request size limits, model aliases, and routing rules before traffic reaches llama-swap/llama-cpp.
- Route Claude Code or other Anthropic clients through one observable gateway while preserving subscription/OAuth bearer flows.
- Keep Prometheus metrics and searchable SQLite request history for a single-box self-hosted AI stack.

<table>
  <tr>
    <td align="center" valign="top">
      <sub><strong>Dashboard</strong><br />Live traffic, tokens, model residency, upstream and GPU health</sub>
    </td>
    <td align="center" valign="top">
      <sub><strong>Playground</strong><br />Chat against local endpoints with request/response inspection</sub>
    </td>
    <td align="center" valign="top">
      <sub><strong>Request detail</strong><br />Routing, attribution, latency, tokens, and payload metadata</sub>
    </td>
    <td align="center" valign="top">
      <sub><strong>Logs</strong><br />Raw llama-swap, proxy, and upstream streams in one viewer</sub>
    </td>
  </tr>
  <tr>
    <td valign="top">
      <img alt="Dark - Dashboard" src="./.github/assets/dashboard.png" />
    </td>
    <td valign="top">
      <img alt="Dark - Playground" src="./.github/assets/playground-chat.png" />
    </td>
    <td valign="top">
      <img alt="Dark - Request Details" src="./.github/assets/request-details.png" />
    </td>
    <td valign="top">
      <img alt="Dark - Logs" src="./.github/assets/logs.png" />
    </td>
  </tr>
  <tr>
    <td align="center" valign="top">
      <sub><strong>Model detail</strong><br />Load history, stats, recent requests, and config context</sub>
    </td>
    <td align="center" valign="top">
      <sub><strong>Speech playground</strong><br />Audio and image-capable endpoint testing</sub>
    </td>
    <td align="center" valign="top">
      <sub><strong>Policies</strong><br />Aliases, routing rules, passthrough auth, and request limits</sub>
    </td>
    <td align="center" valign="top">
      <sub><strong>Requests</strong><br />Searchable history with filters, sorting, and histogram</sub>
    </td>
  </tr>
  <tr>
    <td valign="top">
      <img alt="Dark - Model Details" src="./.github/assets/model-details.png" />
    </td>
    <td valign="top">
      <img alt="Dark - Speech" src="./.github/assets/playground-speech.png" />
    </td>
    <td valign="top">
      <img alt="Dark - Policies" src="./.github/assets/policies.png" />
    </td>
    <td valign="top">
      <img alt="Dark - Requests" src="./.github/assets/requests.png" />
    </td>
  </tr>
</table>


## ⚡ Quick start (Docker Compose)

Choose the compose file that matches your GPU vendor. Both setups use `./config/config.yaml` for llama-swap config, `./models/` for model files, and expose llama-dash on `http://localhost:3000`.

### AMD / ROCm

```bash
cp config/config.example.yaml config/config.yaml  # edit models
docker compose -f docker-compose.amd.yaml up -d
```

`docker-compose.amd.yaml` runs `ghcr.io/mostlygeek/llama-swap:rocm`, passes through `/dev/kfd` and `/dev/dri`, and also mounts `/dev/dri` into llama-dash so AMD GPU stats work in the dashboard.

### NVIDIA / CUDA

```bash
cp config/config.example.yaml config/config.yaml  # edit models
docker compose -f docker-compose.nvidia.yaml up -d
```

`docker-compose.nvidia.yaml` runs `ghcr.io/mostlygeek/llama-swap:cuda` and requests `gpus: all` for the llama-swap service. This requires the NVIDIA Container Toolkit on the host.

## 🏗️ Manual setup

### Requirements

- Node 24+
- pnpm
- A reachable [llama-swap](https://github.com/mostlygeek/llama-swap) instance

### Install

```bash
cp .env.example .env   # edit INFERENCE_BASE_URL to point at your instance
pnpm install
pnpm db:migrate        # creates data/dash.db
pnpm dev               # http://localhost:5173
```

## 🏔️ Environment

Copy `.env.example` to `.env` and fill in the values.

| Variable | Default | Notes |
|---|---|---|
| `INFERENCE_BACKEND` | `llama-swap` | Active inference backend. Only `llama-swap` is currently implemented. |
| `INFERENCE_BASE_URL` | `http://localhost:8080` | Inference backend base URL. No trailing slash. |
| `INFERENCE_INSECURE` | `false` | Skip TLS verification for inference backend with self-signed certs. |
| `INFERENCE_CONFIG_FILE` | (empty) | Absolute path to the backend config file. Required for the llama-swap config editor. |
| `DATABASE_PATH` | `data/dash.db` | SQLite file, relative to CWD. SQLite `:memory:` and `file:` URI paths are preserved for tests/special deployments. |
| `BETTER_AUTH_SECRET` | | Secret for signing Better Auth session data; `openssl rand -base64 33` |
| `BETTER_AUTH_URL` | inferred | Optional external base URL for Better Auth redirects/cookies. Set this to the public HTTPS origin when using passkeys outside localhost. |

See [`docs/2026_05_03_inference_backends.md`](./docs/2026_05_03_inference_backends.md) for the backend abstraction, capability model, and future Ollama notes.

## ⚙️ How it's wired

- `src/server/proxy/*` — the `/v1/*` pass-through: streaming SSE preserved, proxy context/body snapshots kept isolated, bounded request/response capture for logs, token counts scraped from responses as they fly by, and one queued SQLite row per completed request.
- `src/server/admin/*` — the `/api/*` admin surface consumed by the UI, with grouped route modules under `src/server/admin/routes/*` for models, requests, config, keys, aliases, routing, settings, and system health.
- `src/server/auth.ts` — Better Auth setup for dashboard username/password and passkey sessions; protects UI and `/api/*`, not `/v1/*`. Signup is only allowed while no dashboard user exists.
- `src/server/gpu-poller.ts` — polls `nvidia-smi` / `rocm-smi` / `system_profiler` every 10s, caches result in memory, and feeds dashboard/System GPU details. AMD APUs use GTT (not VRAM) for actual usable memory; Apple shows unified memory and core count when available.
- `src/server/model-watcher.ts` — polls the inference backend running-model capability every 15s, diffs state, writes load/unload events to `model_events` table.
- `src/server/inference/*` — selected inference backend facade plus backend-specific adapters and hints.
- `src/server/llama-swap/client.ts` — typed client over llama-swap's HTTP API.
- `src/server/db/*` — Drizzle schema, SQLite initialization, and request/model-event indexes for common dashboard query paths. Apply migrations explicitly with `pnpm db:migrate`.
- `src/server/metrics.ts` — Prometheus text metrics for proxy requests, tokens, latency window gauges, queue depth/drops, upstream reachability, running models, and GPU gauges at `/metrics`.
- `Dockerfile`, `prod-server.mjs`, `docker-compose.amd.yaml`, `docker-compose.nvidia.yaml` — production container packaging for llama-dash by itself or bundled with llama-swap.
- `src/routes/*` — thin TanStack Start route entrypoints for `/`, `/login`, `/models`, `/models/:id`, `/requests`, `/logs`, `/system`, `/playground`, `/config`, `/settings`, `/keys`, `/keys/:id`, `/attribution`, `/policies`, `/endpoints`.
- `src/features/*` — feature-local page components and helpers grouped by route area (`dashboard`, `requests`, `keys`, `models`, `playground`, etc.).
- `src/lib/queries.ts` — TanStack Query hooks with 5s polling for live updates.

## ✴️ Claude Code / Anthropic passthrough

Route any Anthropic SDK (including claude-code) through llama-dash for
logging, filtering, and per-request inspection. Supports Anthropic subscriptions. Traffic flows:

```
Claude Code ──► llama-dash :5173 (log + filter) ──► api.anthropic.com
```

**Client config** (`~/.claude/settings.json`):

```json
{ 
  "env": { 
    "ANTHROPIC_BASE_URL": "http://<llama-dash-host>:3000" 
  } 
}
```

Leave `ANTHROPIC_AUTH_TOKEN` unset when using subscription OAuth — Claude
Code manages the bearer itself and llama-dash passes it through unchanged.

In llama-dash, configure an explicit routing rule in Policies for `/v1/*` 
target path or Claude source model names, using `continue`, `passthrough` auth, preserved client 
`Authorization`, and direct target `https://api.anthropic.com/v1`. This
will result in all Anthropic requests being transparently proxied through
while logging all traffic in llama-dash and applying filters.

## 🤖 Acknowledgements

This project was developed with significant assistance from LLMs. Architecture decisions, implementation, and documentation were all shaped through human-AI collaboration.

## 📝 License

MIT
