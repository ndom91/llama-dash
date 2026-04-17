# llama-dash — Plan

A management dashboard and LLM proxy that sits in front of [llama-swap](https://github.com/mostlygeek/llama-swap). Users run one Docker Compose stack and get a single polished UI + a featureful OpenAI-compatible endpoint; llama-swap is an internal implementation detail.

## Goals

- Single-pane dashboard for local LLM infrastructure on a user's own hardware.
- OpenAI- and Anthropic-compatible endpoint with proxy features: auth, quotas, logging, filtering, key-scoped model access.
- Model lifecycle management (load / unload / configure / hot-reload) driven from the UI.
- Usage analytics (per-model, per-key, over time) backed by a persistent store.
- Deployable as Docker Compose, GPU-vendor agnostic (user brings their own drivers).

## Non-goals

- Running inference ourselves. That's llama-swap + llama.cpp's job.
- Solving multi-platform GPU builds. We inherit llama-swap's `:cuda` / `:rocm` / `:vulkan` / `:intel` / `:musa` images.
- Multi-tenant SaaS. This is a self-hosted tool for one team / one box.
- Distributed deployment. Single-host to start.

## Current reference deployment (2026-04-17)

This is the bare-metal setup llama-dash will be developed against. It's a working llama-swap stack that predates the dashboard — dev can proxy to it until the Docker packaging story is ready.

```
┌─ https://llama-swap.puff.lan ────────────────────────┐
│                                                      │
│  Caddy (:443)  — TLS with self-signed cert from      │
│                  internal CA, flush_interval -1 for  │
│                  SSE, 10m r/w timeouts               │
│                  /etc/caddy/Caddyfile                │
│                                                      │
│        │                                             │
│        ▼                                             │
│  llama-swap (:8080) — systemd unit, User=llama-swap, │
│                       KillMode=mixed, -watch-config  │
│                       /usr/local/bin/llama-swap      │
│                       /etc/llama-swap/config.yaml    │
│        │                                             │
│        ▼                                             │
│  Upstream llama-server procs + one remote peer       │
└──────────────────────────────────────────────────────┘
```

**Host**: LXC container named `llama-server`.

**llama.cpp binary**: `/opt/llama-upstream/llama-server` (downloaded upstream builds, not package-managed — user updates by replacing the binary).

**Models currently configured**:

| ID | Role | Notes |
|---|---|---|
| `gemma-4-26B-A4B-it` | general | **Preloaded on startup** via `hooks.on_startup.preload`. Swaps out when other models are requested (no `groups:` block — conscious choice). |
| `qwen3.6` | general | 32K ctx, BF16 mmproj. |
| `qwen3.6-coder` | coding | Same base model as `qwen3.6` but F16 mmproj, 262K ctx, `--parallel 2`, flash-attn on. VRAM-heavy. |
| `kokoro` | TTS peer | FastKokoro instance on a separate host. `filters.setParams.voice: "af_heart"` enforced — the llama-swap playground's TTS UI doesn't expose voice selection, and Kokoro falls back to a low-quality default without it. |

**Not migrated** from the original `/opt/models.ini` (intentional — mentioned here so we remember what else could come over): `qwen3.5-35B`, `qwen3.5-27B`, `kappa-20B`, `qwen3-coder-next`, `Qwen3.6-code-old`.

**Auth**: none. llama-swap is open on the LAN. Dashboard should add its own `apiKeys:` layer when it fronts this.

**Open WebUI**: points at `https://llama-swap.puff.lan/v1` as an OpenAI-compatible backend. Needs the internal CA in its trust store or `WEBUI_VERIFY_SSL=false`.

### Why this matters for llama-dash development

- We have a **real, used llama-swap** to point at while building the sidecar — no need to stand up a test instance.
- The Caddy layer is a template for the eventual Docker Compose deployment (`flush_interval -1`, 10m timeouts, self-signed cert pattern).
- Before the Docker packaging is done, llama-dash can run as a plain Go binary that connects to `http://llama-server-lxc:8080` (or wherever) for development.
- Once llama-dash ships, the "migration path" for this setup is: stop the llama-swap systemd unit, run the Compose stack, point Caddy at llama-dash:8080 instead of llama-swap:8080. Nothing else changes.

## Architecture

```
┌─ client (app / IDE / curl) ────────────┐
│   POST /v1/chat/completions            │
└────────────────┬───────────────────────┘
                 ▼
┌─ llama-dash (our sidecar) :8080 ───────┐
│  1. auth        (API key lookup)       │
│  2. ACL         (key → allowed models) │
│  3. rate limit  (per key, per window)  │
│  4. filter      (block / inject)       │
│  5. log request (SQLite)               │
│  6. proxy → llama-swap /v1/*           │
│  7. tee response → SQLite              │
│  8. return to client                   │
│                                        │
│  Also serves:                          │
│   - Dashboard UI (/) — SPA             │
│   - Admin API (/api/*)                 │
│   - Reads llama-swap /running,         │
│     /logs/stream/* for live views      │
│   - Writes config.yaml on disk         │
└────────────────┬───────────────────────┘
                 ▼
┌─ llama-swap :9292 (internal only) ─────┐
│   spawns/kills llama-server processes  │
│   hot-reloads on config.yaml change    │
└────────────────┬───────────────────────┘
                 ▼
          llama-server procs (per model)
```

Single public port (8080). llama-swap is not exposed on the host.

## llama-swap API surface we consume

From their README and OpenAPI-ish endpoints:

- `POST /v1/*` — forward OpenAI / Anthropic calls unchanged (after our middleware)
- `GET /running` — which models are currently loaded
- `POST /models/unload` — unload a model
- `GET /upstream/:model_id/*` — proxy directly to a specific llama-server (useful for `/metrics`)
- `GET /logs/stream`, `/logs/stream/proxy`, `/logs/stream/upstream`, `/logs/stream/{model_id}` — SSE log streams
- `GET /health`
- `GET /v1/models` — OpenAI-format list including peers
- Hot reload: invoked by editing `config.yaml` when llama-swap runs with `-watch-config` (fsnotify-based; no SIGHUP)

**llama-swap CLI flags** (confirmed by reading `llama-swap.go`):

- `-config <path>` (default `config.yaml`)
- `-listen <addr>` (default `:8080`, or `:8443` with TLS)
- `-watch-config` — auto-reload on config file change
- `-tls-cert-file`, `-tls-key-file`
- `-version`

Signals: handles `SIGINT` / `SIGTERM` with graceful shutdown of child llama-server processes. No `SIGHUP`.

**To verify when implementation starts:**

- Whether a JSON "list configured models" endpoint exists (vs. just the OpenAI-format `/v1/models`), or we parse `config.yaml` ourselves.
- Whether per-model Prometheus metrics are reachable via `/upstream/:model_id/metrics`.
- Whether `/logs/stream` carries structured events or just raw lines.

## Config is the API between us and llama-swap

llama-swap's `config.yaml` is the single source of truth for model definitions. llama-dash reads it to render the models view, writes it to add/edit/remove models, and llama-swap picks up changes via `-watch-config`. No IPC needed — the file *is* the contract.

Rules:

- Atomic writes (write to `.tmp`, fsync, rename).
- Preserve user comments and key order (use a YAML library that round-trips, e.g. `gopkg.in/yaml.v3` with node mode).
- Validate against llama-swap's published `config-schema.json` before writing.
- Back up the previous version on every write (last N kept).

## Data model (SQLite)

Single `data.db` in a mounted volume. Keep it boring.

```
api_keys
  id, name, key_hash, created_at, disabled_at
  allowed_models (json array, empty = all)
  rate_limit_rpm, rate_limit_tpm (nullable = unlimited)
  monthly_token_quota (nullable)

requests
  id, key_id (nullable for unauth), model, endpoint,
  started_at, duration_ms, status_code,
  prompt_tokens, completion_tokens, total_tokens,
  request_body (json, optional — off by default for privacy),
  response_body (json, optional),
  error (nullable)

filter_rules
  id, name, scope (request|response), pattern, action (block|redact|inject),
  replacement, enabled, created_at

usage_rollups  -- optional, for fast dashboard queries
  key_id, model, day, requests, prompt_tokens, completion_tokens
  (materialized from requests on a schedule)

settings
  key, value   -- UI prefs, feature flags, etc.
```

Start without rollups. Add when `requests` is slow enough to matter.

## Feature roadmap

### MVP (ship-first slice)

1. Docker Compose stack with llama-swap pinned to a specific tag.
2. Pass-through proxy for `/v1/*` (no middleware yet) — verify routing works.
3. SQLite request logging (counts, tokens, status).
4. Dashboard homepage:
   - "Running models" list (from `/running`).
   - Recent requests table.
   - Live log tail (from `/logs/stream`).
5. Single admin auth (username/password or single bearer token) for the UI.

### v1 (the reason this project exists)

6. API key management (CRUD in UI, hashed at rest).
7. Per-key rate limits (token bucket, in-memory, reset on process restart is fine for MVP).
8. Per-key model allow-list enforcement.
9. Usage dashboard: requests / tokens over time, top models, top keys.
10. Config editor: add / remove / edit models from the UI, writing to `config.yaml`.
11. Content filters: regex block/redact on prompts and responses; system prompt injection per key or per model.

### Later / nice-to-have

- Playground (chat UI hitting our own `/v1/*` with a selected key).
- Cost estimates (configurable $/token per model).
- Webhook on quota breach or error spike.
- Export logs (CSV / JSONL).
- Replay a logged request against a different model.
- Multi-admin accounts with roles.

## Tech choices

- **Runtime**: Node.js + TypeScript. We're consuming llama-swap over HTTP only, so we don't need Go's systems chops here; TS is faster to iterate in and the UI and server share a language.
- **Framework**: [TanStack Start](https://tanstack.com/start) (React). Full-stack — UI routes and server routes in one process, backed by h3/Nitro. The proxy lives as a server route alongside the dashboard.
- **Package manager**: pnpm.
- **DB**: SQLite via `better-sqlite3` + Drizzle ORM. Synchronous, fast, good DX with Drizzle's typed queries and migrations.
- **Auth**: deferred past the first pass — single-user local tool. When added: bcrypt-hashed admin password + session cookie for UI; API keys hashed with SHA-256 for `/v1/*`.
- **Config**: dashboard's own config is env-var driven; llama-swap's `config.yaml` is edited via a YAML round-tripper (picked when the config-editor feature lands).

## First-pass scope (2026-04-17)

Narrower than the MVP list below — the goal is a working end-to-end loop to build on.

1. TanStack Start app scaffolded, `pnpm dev` serves UI + server routes on `localhost:5173`.
2. SQLite (`data/dash.db`) with Drizzle migrations. One table: `requests` (metadata only — no bodies).
3. Pass-through proxy route at `/v1/*` → `http://llama-swap.puff.lan/v1/*`. Streams SSE unchanged.
4. Request logging middleware captures: model, endpoint, status, duration, prompt/completion/total tokens (from final `usage` chunk when `stream_options.include_usage: true`, else 0).
5. Dashboard UI:
   - Recent requests table (paginated, newest first).
   - "Models" view — list from llama-swap `GET /v1/models`, marks which are running (from `GET /running`), with **Unload** buttons that call `POST /models/unload` via our server routes.
6. No auth, no API keys, no rate limiting, no filters, no body logging. All listed above arrive later.

**Dev target**: `http://llama-swap.puff.lan` (Caddy's :80 → :443 redirect is disabled on that host, so plain HTTP works). Configurable via `LLAMASWAP_URL` env var.

## Deployment

```yaml
# docker-compose.yml shipped in this repo
services:
  llama-swap:
    image: ghcr.io/mostlygeek/llama-swap:v166-cuda-b6795  # pinned
    runtime: nvidia
    volumes:
      - ./models:/models
      - ./config:/config
    command: -config /config/config.yaml -watch-config -listen :9292
    # not exposed on host

  llama-dash:
    image: yourrepo/llama-dash:latest
    ports:
      - "8080:8080"
    volumes:
      - ./config:/config
      - ./data:/data
    environment:
      LLAMASWAP_URL: http://llama-swap:9292
      CONFIG_PATH: /config/config.yaml
      DATA_DIR: /data
    depends_on:
      - llama-swap
```

Ship variants: `docker-compose.cuda.yml`, `docker-compose.rocm.yml`, `docker-compose.vulkan.yml`, `docker-compose.cpu.yml`. Only difference is the llama-swap image tag and GPU runtime args.

Users install by cloning the repo, picking the right compose file, dropping GGUF files in `./models/`, and running `docker compose up`.

## Open questions

- Do we expose an escape hatch to llama-swap's own UI (`/llama-swap/*` proxy) or fully hide it?
- How do we surface llama-swap version / health mismatches in our UI?
- Streaming: how do we count tokens from SSE responses without breaking streaming semantics? (Parse as we tee; flush to client before persisting.)
- For Anthropic `/v1/messages`, token accounting is different from OpenAI — normalize or keep separate?
- Do we ever want to support inference backends other than llama-swap (vLLM direct, Ollama)? If yes, abstract the upstream interface early; if no, bind to llama-swap specifics freely.

## Lessons learned during infra setup (2026-04-17)

Non-obvious things discovered while bringing the reference deployment up. Worth knowing when writing the config editor and validator in llama-dash.

### llama-swap config

- **`macros:` is top-level only**, not per-model. llama-swap silently ignores unknown keys, so per-model `macros:` blocks parse fine but never substitute — `${foo}` in `cmd` then reaches llama-server as a literal string and the server crashes. Our config validator must warn on this specifically.
- **Per-model keys** (confirmed from `config.example.yaml`): `cmd`, `name`, `description`, `env`, `proxy`, `checkEndpoint`, `ttl`, `useModelName`, `filters`, `aliases`, `metadata`. No `macros`.
- **Peer filters support `stripParams` and `setParams`, but NOT `setParamsByID`** — so injecting per-variant params (e.g. voice-per-alias on a TTS peer) requires multiple peer entries, one per variant.
- **`setParams` always overrides client-sent values.** Useful for enforcement (e.g. forcing `voice: af_heart` on Kokoro) but means `model:` is a protected param that can't be rewritten.
- **`hooks.on_startup.preload` does NOT pin a model resident.** Preloaded models still swap out on a request for another model. True "always loaded alongside others" requires a `groups:` entry with `swap: false`.
- **`-watch-config` uses fsnotify** — edit the file in place and it reloads. No SIGHUP, no `systemctl reload` needed.

### systemd

- `KillMode=mixed` is the right choice — llama-swap handles SIGTERM itself and cleans up its child llama-server processes. `control-group` would kill children prematurely and skip llama-swap's cleanup.
- `TimeoutStopSec=60` is a reasonable floor; large model unloads can take time.
- `ProtectHome=yes` is safe *only if* no model paths live under `/home`. Our reference setup uses `/mnt/models`, so it's fine. Document this caveat.
- `PrivateDevices=yes` **breaks GPU access**. Never set it on the llama-swap unit or on llama-dash (once llama-dash supervises upstream processes directly — not MVP, but v2+).
- The service user needs group membership for GPU access: `render`, `video` on ROCm/Intel; NVIDIA usually works out of the box once the driver is installed.

### Caddy

- **Relative paths in `tls <cert> <key>` don't work** — Caddy's working directory is not `/etc/caddy/`. Always use absolute paths.
- `flush_interval -1` on `reverse_proxy` disables buffering for any response type. Streaming SSE works out of the box; this makes it bullet-proof.
- Graceful reload via `systemctl reload caddy` — invalid config fails the reload but leaves the running server untouched.
- No built-in file watcher. If we want the llama-dash Docker image to auto-reload Caddy on Caddyfile changes, we'd need a sidecar watcher; usually not worth it.
- `caddy fmt --overwrite` clears the "not formatted" warning.

### nginx (alternative, if users prefer it over Caddy)

Three buffering directives are *required* for streaming — `proxy_buffering off`, `proxy_cache off`, `proxy_request_buffering off`. Missing any of them breaks SSE silently (chunks arrive all at once at the end). Plus `X-Accel-Buffering: no` as a belt-and-suspenders header.

### Implications for llama-dash

- The config validator should catch the macros-scoping mistake with a clear error message. It's easy to make and silent to fail.
- When we build the config editor, round-trip comments are non-negotiable — users comment heavily in real configs (commented-out model variants, tuning notes, references to docs).
- The dashboard's "models" view should distinguish **local models** (have `cmd`) from **peers** (don't) — different management affordances (restart vs. reachability check).
- Peer entries need their own panel: health check of the upstream URL, visible `setParams` / `stripParams` rules, test-call button.
- Our docker-compose should ship with a `Caddyfile.example` that mirrors the reference deployment — self-signed cert placeholder, `flush_interval -1`, long read/write timeouts.

## Risks

- **Upstream drift**: llama-swap moves fast. Pin image tags. Test new versions before bumping.
- **Streaming correctness**: token counting while passing SSE through is the subtle bit. Budget time for it.
- **Config round-tripping**: losing user comments on save will erode trust fast. Use a YAML lib that preserves them, and add a test that round-trips every example config.
- **Scope creep**: a playground is tempting but every day spent on it is a day not on the core proxy features. Keep MVP lean.
