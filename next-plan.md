# Next Plan

Items marked ~~strikethrough~~ are shipped. See AGENTS.md § "What's shipped" for details.

## Priority order

1. ~~**Model detail page**~~ — **shipped.** Per-model stats (requests, error rate, avg duration, avg tok/s), load/unload history, recent requests, per-key usage breakdown, config.yaml snippet. TTFT, context-len histogram, GGUF info deferred (need upstream changes).
2. ~~**Live stream console**~~ — **cut.** The request log + detail view already covers this; a real-time token viewer doesn't add enough value.
3. ~~**API key detail page**~~ — **shipped.** Per-key stats (requests, error rate, tokens, duration, tok/s with sparklines), interactive model access panel with checkbox toggles and per-model usage stats, inline key rename, recent requests table. Clickable from keys list. Real $ cost tracking deferred (needs upstream pricing data).
4. **Endpoint directory** — copyable base URLs per key with code examples for openai-python, curl, Continue, OpenWebUI, etc.
5. **Audit log** — admin actions (key created, config reloaded, model loaded by X) separate from request log.
6. **Policies / filters** — prompt guards, max_tokens ceilings, model aliases, denylist/allowlist. Per-key, per-route. Someday.
7. ~~**VRAM timeline**~~ — **descoped.** Model swap timeline on the dashboard already shows model residency over time. A dedicated VRAM memory graph would be incremental — revisit if GPU memory pressure becomes a real issue.

## Backlog

### Observe (telemetry & forensics)

- ~~Live stream console~~ — **cut** (request log covers this)
- Waterfall / trace — per-request timeline: queue → model swap → prefill → decode → stream → close.
- Replay — click any past request, re-run with same params, diff outputs side-by-side.
- Compare runs — select 2–N requests, show overlaid latency/throughput/token curves.
- Error inspector — grouped by error_class, with stack trace + upstream log tail inlined.
- ~~VRAM timeline~~ — **descoped** (model swap timeline covers core use case)

### Operate (model & runtime control)

- ~~Model detail page~~ — **shipped.** Stats, history, requests, key breakdown, config snippet.
- ~~Hot-reload config~~ — **shipped.** Editor with diff preview, schema validation, auto-reload.
- Benchmark runner — one-click "warm + 10 prompts" latency/throughput sweep per model.
- Warm-up policies — pin models, TTL rules, eviction priority, mutually-exclusive model groups.
- ~~GPU / host metrics~~ — **shipped.** NVIDIA, AMD, Apple Silicon. VRAM, utilization, temp, power.
- Process control — restart llama-swap, view current process args, pid, uptime.

### Govern

- ~~API keys vault~~ — **shipped.** Create/revoke/delete, per-key RPM/TPM rate limits, model allow-lists, SHA-256 hashed at rest, per-key usage tracking.
- Upstream credentials — stored per-peer for when llama-dash proxies to external providers.
- ~~Policies / filters~~ → promoted to priority #6
- ~~Audit log~~ → promoted to priority #5
- ~~Cost ledger~~ → folded into API key detail page (priority #3)

### Integrate

- ~~Endpoint directory~~ → promoted to priority #4
- Peer federation — add remote llama-swap as backend; route specific model IDs to it.
- Webhooks — fire on model-load, OOM, error-rate spike.
- OpenAPI browser — rendered /v1/* schema with "try it" panel.

### Signature (oscilloscope-native)

- Scope view — XY panel where you pin any two metrics and watch them plot live.
- Event tape — scrolling terminal-like strip showing recent events (load, unload, 5xx, swap).
- Boot/status card — upstream version, uptime, resident models, VRAM free, last error in one panel.

## Research notes

### Proxy-layer tool injection (investigated, parked)

Idea: inject tools (e.g. web search) into `/v1/chat/completions` requests at
the proxy layer so dumb clients get tool-augmented responses transparently.
Proxy intercepts `tool_calls`, executes server-side, re-submits until the
model returns a final text response.

**Prior art:** LiteLLM has this via MCP Gateway (`require_approval: "never"`),
beta quality. `agent-tools-proxy` does it for non-tool-calling models via
prompt injection. `filthy-tool-fixer` fixes unreliable local model tool
calling with retries and rescue parsing.

**Problem for Home Assistant:** HA is not a dumb client — it already sends its
own tools (Assist intents) and runs its own tool loop. Proxy-injected tools
would conflict with HA's tool handling. The HA-native solution is
[llm_intents](https://github.com/skye-harris/llm_intents), a custom component
that registers web search (SearXNG, Brave, Wikipedia) as HA tools directly.

**When it makes sense:** For truly toolless clients (curl, Telegram bots,
simple chat UIs). Not worth building until there's a concrete non-HA use case.

**If revisited:** SearXNG (self-hosted, free, Docker) is the obvious search
backend. Main risks are latency multiplication (each tool round = full LLM
call), token cost from re-submission, streaming complexity (must buffer
intermediate turns), and small model tool-calling unreliability.
