<h1>
  <img src="./public/favicon.svg" alt="" width="42" align="left" />
  &nbsp;llama-dash
</h1>

<img alt="Dark - Dashboard" src="./.github/assets/dashboard.png" />

Alternative dashboard and proxy on top of [llama-swap](https://github.com/mostlygeek/llama-swap) with many additional features including:

- **Dashboard** — live stats, sparklines, model timeline, upstream health, GPU monitoring.
- **Model management** — load/unload models, per-model stats, load history, config snippet.
- **Request logging** — every `/v1/*` call logged with searchable UI, histogram, and detail view.
- **Transparent proxy** — streaming SSE preserved, token counts scraped in-flight. OpenAI (`/v1/chat/completions`) and Anthropic (`/v1/messages`, `/v1/messages/count_tokens`) shapes both supported — point Claude Code at llama-dash via `ANTHROPIC_BASE_URL` to proxy and track your Claude code usage as well.
- **API keys** — per-key rate limits (RPM/TPM), model allow-lists editable from detail page, hashed at rest, per-key stats and model usage breakdown.
- **Policies** — ordered routing rules with real proxy enforcement for model rewrites and policy rejects, plus per-key system prompt injection and global request size limits.
- **Attribution** — configurable header mapping for client, end-user, and session metadata with setup examples for common clients.
- **Request auditing** — per-key usage tracking across all proxied calls.
- **GPU monitoring** — NVIDIA, AMD, and Apple Silicon. VRAM, utilization, temp, power.
- **Config editor** — edit llama-swap `config.yaml` in-browser with on-demand validation, enforced pre-save schema checks, and auto-reload.
- **Endpoints** — copyable base URL, API key selector, code examples for curl, Python, TypeScript, Home Assistant, Claude Code, opencode, Continue, Open WebUI.
- **Playground** — Supports chat, image, speech and transcribe. See request/response/event tabs plus TTFT, prefill, decode, and stream-close timing when the upstream exposes llama.cpp timing metadata.

<table>
  <tr>
    <td align="center">
      Dashboard
    </td>
    <td align="center">
      Playground - Chat
    </td>
    <td align="center">
      Request Details
    </td>
    <td align="center">
      Logs
    </td>
  </tr>
  <tr>
    <td>
      <img alt="Dark - Dashboard" src="./.github/assets/dashboard.png" />
    </td>
    <td>
      <img alt="Dark - Playground" src="./.github/assets/playground-chat.png" />
    </td>
    <td>
      <img alt="Dark - Request Details" src="./.github/assets/request-details.png" />
    </td>
    <td>
      <img alt="Light - Logs" src="./.github/assets/logs.png" />
    </td>
  </tr>
  <tr>
    <td align="center">
      Model Details
    </td>
    <td align="center">
      Playground - Speech
    </td>
    <td align="center">
      Policies
    </td>
    <td align="center">
      Requests
    </td>
  </tr>
  <tr>
    <td>
      <img alt="Dark - Model Details" src="./.github/assets/model-details.png" />
    </td>
    <td>
      <img alt="Dark - Speech" src="./.github/assets/playground-speech.png" />
    </td>
    <td>
      <img alt="Dark - Policies" src="./.github/assets/policies.png" />
    </td>
    <td>
      <img alt="Dark - Requests" src="./.github/assets/requests.png" />
    </td>
  </tr>
</table>


## Quick start (Docker Compose)

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

## Manual setup

### Requirements

- Node 24+
- pnpm
- A reachable [llama-swap](https://github.com/mostlygeek/llama-swap) instance

### Install

```bash
cp .env.example .env   # edit LLAMASWAP_URL to point at your instance
pnpm install
pnpm db:migrate        # creates data/dash.db
pnpm dev               # http://localhost:5173
```

## Environment

Copy `.env.example` to `.env` and fill in the values.

| Var | Default | Notes |
|---|---|---|
| `LLAMASWAP_URL` | `http://localhost:8080` | Upstream llama-swap base URL. No trailing slash. |
| `LLAMASWAP_INSECURE` | `false` | Skip TLS verification for upstream with self-signed certs. |
| `LLAMASWAP_CONFIG_FILE` | (empty) | Absolute path to llama-swap's `config.yaml`. Required for config editor. |
| `DATABASE_PATH` | `data/dash.db` | SQLite file, relative to CWD. |

## How it's wired

- `src/server/proxy/*` — the `/v1/*` pass-through: streaming SSE preserved, token counts scraped from the response as it flies by, one row per request written to SQLite on completion.
- `src/server/admin/*` — the `/api/*` admin surface consumed by the UI (models, requests, stats, histogram, health, GPU, model-timeline, routing rules, attribution settings).
- `src/server/gpu-poller.ts` — polls `nvidia-smi` / `rocm-smi` / `system_profiler` every 10s, caches result in memory. AMD APUs use GTT (not VRAM) for actual usable memory.
- `src/server/model-watcher.ts` — polls llama-swap `/running` every 15s, diffs state, writes load/unload events to `model_events` table.
- `src/server/llama-swap/client.ts` — typed client over llama-swap's HTTP API.
- `src/server/vite-plugin.ts` — mounts handlers + starts pollers as Vite dev-server middleware for local development.
- `Dockerfile`, `prod-server.mjs`, `docker-compose.amd.yaml`, `docker-compose.nvidia.yaml` — production container packaging for llama-dash by itself or bundled with llama-swap.
- `src/routes/*` — thin TanStack Start route entrypoints for `/`, `/models`, `/models/:id`, `/requests`, `/logs`, `/playground`, `/config`, `/keys`, `/keys/:id`, `/attribution`, `/policies`, `/endpoints`.
- `src/features/*` — feature-local page components and helpers grouped by route area (`dashboard`, `requests`, `keys`, `models`, `playground`, etc.).
- `src/lib/queries.ts` — TanStack Query hooks with 5s polling for live updates.

## Claude Code / Anthropic passthrough

Route any Anthropic SDK (Claude Code included) through llama-dash for
logging, filtering, and per-request inspection. Supports Anthropic subscriptions. Traffic flows:

```
Claude Code ──► llama-dash :5173 (log + filter) ──► llama-swap peer ──► api.anthropic.com
```

**1. Client config** (`~/.claude/settings.json`):

```json
{ "env": { "ANTHROPIC_BASE_URL": "http://<llama-dash-host>:5173" } }
```

Leave `ANTHROPIC_AUTH_TOKEN` unset when using subscription OAuth — Claude
Code manages the bearer itself and llama-dash passes it through unchanged.

**2. llama-swap `config.yaml`** — add a `peers:` entry pointing at
Anthropic; omit `apiKey` so the client's OAuth/Bearer flows through:

```yaml
peers:
  anthropic:
    proxy: https://api.anthropic.com
    models:
      - claude-opus-4-7
      - claude-sonnet-4-6
      - claude-haiku-4-5-20251001
```

## Acknowledgements

This project was developed with significant assistance from LLMs. Architecture decisions, implementation, and documentation were all shaped through human-AI collaboration.

## License

MIT
