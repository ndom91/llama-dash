# Provider subscriptions (MiniMax / Xiaomi MiMo / Z.AI GLM)

Date: 2026-10-31
Branch: `feat/cloud-provider-subscriptions`

## Problem

llswap-dash only proxied to llama-swap and a small set of direct upstream hosts
(`api.openai.com`, `api.anthropic.com`, `chatgpt.com`). Operators with cloud
subscription keys (MiniMax, Xiaomi MiMo Token Plan, Z.AI GLM Coding Plan) had to
configure every CLI/SDK separately against each provider.

## Model

One **target** = one subscription entry point = one API key. A target has an
origin (with region where the provider is regional, e.g. MiMo Token Plan
`token-plan-cn` vs `token-plan-sgp`) and one or more **surfaces**:

| Surface | Mount path (MiMo/MiniMax) | Path join | Proxy endpoints claimed |
| ------- | ------------------------- | --------- | ----------------------- |
| OpenAI Chat Completions | `/v1` | `strip-v1` | `/v1/chat/completions`, `/v1/completions` |
| Anthropic Messages | `/anthropic` | `keep-v1` | `/v1/messages`, `/v1/messages/count_tokens` |
| OpenAI Responses (Z.AI) | `/api/v1` | `strip-v1` | `/v1/responses` |

`strip-v1` drops the incoming `/v1` prefix (base already carries the version
segment); `keep-v1` appends the incoming path verbatim (base is a mount point).

**Connecting one target wires every surface at once** — the operator never
connects "OpenAI" and "Anthropic" separately. The catalog
(`src/lib/providers.ts`) carries no model lists: models are discovered live
from the provider's `GET /v1/models` at connect time (and on demand via
refresh) and stored in `provider_connections.models_json`. The Models page
(`/cloud-models`) renders them; the llama-swap load/unload page stays at
`/models` under the `llama-swap` nav entry.

## What connect creates

1. one encrypted `api_key` credential (never returned by the admin API),
2. one routing rule per surface (first-match-wins ordering, provider rules
   floated to the top), each targeting the surface mount path with the stored
   credential,
3. the auto-discovered model list.

Auth headers follow the provider surface: OpenAI surfaces send
`Authorization: Bearer <key>`; Anthropic surfaces send both `x-api-key: <key>`
(raw) and `Authorization: Bearer <key>` so any SDK works. When a stored
credential is injected, the client's own `authorization`/`x-api-key` copies are
stripped first.

## API

- `GET /api/providers` — connections + discovered models
- `POST /api/providers/connect` — `{ targetId, apiKey, name? }`
- `POST /api/providers/disconnect` — `{ targetId }`
- `POST /api/providers/test` — probe + discover models without saving
- `POST /api/providers/models/refresh` — re-fetch the model list

## Known constraints

- `CREDENTIAL_ENCRYPTION_KEY` (32+ chars) is required before connecting — the
  key is stored in the encrypted credential vault.
- A provider rule uses `continue` actions: requested model names pass through
  to the provider unchanged, so use the discovered model IDs verbatim.
