<h1>
  <img src="./public/favicon.svg" alt="" width="42" align="left" />
  &nbsp;llama-dash
</h1>

<img alt="Dark - Dashboard" src="./.github/assets/dashboard.png" />

llama-dash turns a self-hosted local inference box into an observable, policy-controlled AI gateway: one UI for model state, request history, API keys, routing rules, proxy metrics, and client setup. The implemented inference backend is currently [llama-swap](https://github.com/mostlygeek/llama-swap) over llama.cpp.

It is the single public entrypoint for OpenAI-compatible and Anthropic-compatible clients. llama-dash owns proxy policy, logging, auth, routing, and backend normalization, your selected inference backend owns local model processes and inference when traffic is routed to local models.

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

- **Watch the box** — live request, token, model, upstream, CPU/GPU, update status, and static inference-host inventory in one dashboard.
- **Manage models** — load/unload models, inspect per-model stats, capabilities, and llama-swap selector routing, view residency history, and edit llama-swap config with validation.
- **Proxy clients** — expose OpenAI/Anthropic-compatible `/v1/*` endpoints, native llama.cpp `POST /infill`, and llama-swap's `/audiocpp/*` passthrough for local models, peers, direct upstreams, Claude Code, Continue, Open WebUI, and more.
- **Track requests** — searchable request history with filters, histograms, detail views, attribution metadata, token counts, and cost estimates. Details reuse cached summaries immediately while payloads load; hovering or keyboard-selecting a list row prefetches its metadata.
  Local llama.cpp prefill/decode timings are shown for streaming and non-streaming responses when provided; new measurements are retained independently of captured bodies. Older logs fall back to their retained response body.
  Streamed inference requests also record proxy-observed time to first output and the span between first and last output deltas, including OpenAI Responses, chat completions, and Anthropic streams. These are not upstream prefill/decode timings and are available only for newly recorded requests.
  Adjacent request navigation uses a dedicated SQLite index, created automatically by the startup migration.
  Scheduled retention cleanup logs its duration, candidate-selection time, and aggregate row counts for operational diagnosis.
  Key-detail statistics use a key/time index, and key/model request lists avoid loading stored payloads.
- **Control access** — dashboard login, hashed API keys, per-key RPM/TPM limits, explicit allow-all or restricted model access, unavailable-model cleanup, MCP relay allow-lists, and per-key usage breakdowns.
- **Enforce policy** — routing rules for model rewrites, rejects, passthrough auth, direct HTTPS upstreams, encrypted credentials, system prompts, and global request size limits.
- **Test models** — playgrounds for chat, image, speech, and transcription, including article-to-speech extraction.
- **Export ops data** — raw log streams, retention controls, request auditing, and low-cardinality Prometheus metrics at `/metrics`.
- **Move fast** — `g`-leader keyboard navigation (`g d` dashboard, `g r` requests, `g l` logs, …), `j`/`k`/`Enter` through the request list, and `H`/`L` between request details.
  Client navigation briefly reuses the authenticated shell and shows pending feedback during slow route checks; admin APIs always enforce sessions server-side.
  Navigation reuses the destination's full skeleton, including the request-detail layout, instead of leaving a mostly blank "Opening page" placeholder.
  Request metadata and captured payloads load independently in parallel, so large bodies do not block the summary; payload failures have their own retry action.
  Large SSE captures render a measured, virtualized event window while retaining full-payload copy/export.
  Individual long response values also render in bounded chunks, including raw text and assembled SSE output. Normal JSON keeps syntax highlighting; oversized lines use plain text. Copy/export retains the complete capture.
  Session lookups are deduplicated within each server request without sharing session or query data across SSR requests.
  Conditional JSON polling serializes once and uses native hashing; captured-payload responses use `no-store` rather than validators.
  Interactive request loads take priority over telemetry and speculative metadata prefetches; abandoned request fetches are cancelled.
  Validator and inactive-payload caches are bounded, and reconnects refresh live data without refetching completed payloads. Live request insertion keeps loaded pages bounded while preserving older-history pagination.
  Payload loading, failure/retry, and successfully loaded empty captures are distinct states. Implementation ownership is documented in [the loading maintainability notes](./docs/2026_10_26_loading_maintainability.md).

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
      <img alt="Dark - Logs" src="./.github/assets/logs_2.png" />
    </td>
  </tr>
  <tr>
    <td align="center" valign="top">
      <sub><strong>Model detail</strong><br />Load history, stats, recent requests, and config context</sub>
    </td>
    <td align="center" valign="top">
      <sub><strong>Speech playground</strong><br />Read any article and audio testing</sub>
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
      <img alt="Dark - Speech" src="./.github/assets/playground-speech_2.png" />
    </td>
    <td valign="top">
      <img alt="Dark - Policies" src="./.github/assets/policies_2.png" />
    </td>
    <td valign="top">
      <img alt="Dark - Requests" src="./.github/assets/requests.png" />
    </td>
  </tr>
</table>


## ⚡ Quick start (Docker Compose)

Choose the compose file that matches your GPU vendor. Both setups pull the published `ghcr.io/ndom91/llama-dash:latest` image, use `./config/config.yaml` for llama-swap config, mount `./models/` for model files, and expose llama-dash on `http://localhost:3000`.

Clone the repository for its Compose files and example configuration, then create the local environment and llama-swap config:

```bash
git clone https://github.com/ndom91/llama-dash.git
cd llama-dash
cp .env.example .env
cp config/config.example.yaml config/config.yaml
```

Set `BETTER_AUTH_SECRET` in `.env` to the output of `openssl rand -base64 33`. The compose files load `.env` via `env_file` and won't start without it. `CREDENTIAL_ENCRYPTION_KEY` is only needed if you later store upstream provider credentials.

Place a GGUF model in `./models/`, then set the matching path and model ID in `config/config.yaml`. The supplied example expects `./models/llama-3.gguf` and declares it as `llama3`.

### AMD / ROCm

```bash
docker compose -f docker-compose.amd.yaml pull
docker compose -f docker-compose.amd.yaml up -d
```

`docker-compose.amd.yaml` runs `ghcr.io/mostlygeek/llama-swap:rocm`, passes through `/dev/kfd` and `/dev/dri`, and also mounts `/dev/dri` into llama-dash so AMD GPU stats work in the dashboard. The config directory is mounted into both services so llama-dash can atomically save `config.yaml` and llama-swap can reload it through `-watch-config`.

### NVIDIA / CUDA

```bash
docker compose -f docker-compose.nvidia.yaml pull
docker compose -f docker-compose.nvidia.yaml up -d
```

`docker-compose.nvidia.yaml` runs `ghcr.io/mostlygeek/llama-swap:cuda` and requests `gpus: all` for the llama-swap service. This requires the NVIDIA Container Toolkit on the host. The config directory is mounted into both services so llama-dash can atomically save `config.yaml` and llama-swap can reload it through `-watch-config`.

Set `LLAMA_DASH_IMAGE_TAG` to a release tag to pin llama-dash to a specific version. Contributors can build locally instead by adding `-f docker-compose.build.yaml` and `--build` to either command, for example:

```bash
docker compose -f docker-compose.amd.yaml -f docker-compose.build.yaml up -d --build
```

Open `http://localhost:3000`, create the first dashboard user, then load your configured model from **Models**. llama-dash runs database migrations automatically when it starts.

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

See the [environment variables reference](https://llama-dash.dev/docs/reference/environment-variables)
for the complete list of variables, defaults, and deployment notes.

## ✴️ Claude Code / Anthropic passthrough

Route any Anthropic SDK, including Claude Code, through llama-dash for logging,
filtering, per-request inspection, and Anthropic subscription passthrough.

See the [Claude Code & Anthropic passthrough guide](https://llama-dash.dev/docs/clients/claude-code)
for client setup, routing rules, subscription OAuth, and provider-key flows. For
remote MCP servers, see the [MCP relays guide](https://llama-dash.dev/docs/clients/mcp-relays).

## 🤖 Acknowledgements

This project was developed with significant assistance from LLMs. Architecture decisions, implementation, and documentation were all shaped through human-AI collaboration.

## 📝 License

MIT
