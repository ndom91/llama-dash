# Test system

Date: 2026-07-24

## Goals

- Keep fast, co-located unit tests for pure proxy/admin logic.
- Add a thin integration tier that exercises real SQLite + admin modules +
  `handleProxyRequest`, with the only network boundary mocked (undici).
- Avoid browser E2E until proxy/admin regressions demand it.

## Layout

| Path | Role |
| --- | --- |
| `vitest.config.ts` | Two projects: `unit` and `integration` |
| `src/**/*.test.ts` | Unit tests (existing style, mocked DB/upstream) |
| `src/**/*.integration.test.ts` | Integration tests |
| `src/test/fixtures/` | Shared builders (`makeRoutingRule`, `makeApiKeyRow`, …) |
| `src/test/harness/` | `:memory:` DB reset, fake upstream, `settleProxyResponse` |
| `src/test/integration-setup.ts` | Env + undici mock before app imports |

## Scripts

- `pnpm test` — both projects (what CI runs)
- `pnpm test:unit` / `pnpm test:integration` — one project
- `pnpm test:watch` — Vitest watch mode

## Inference backend coverage

Both supported `INFERENCE_BACKEND` values have dummy HTTP fixtures and tests
aligned to upstream response contracts:

| Kind | Official sources | Dummy highlights |
| --- | --- | --- |
| `llama-swap` | [README](https://github.com/mostlygeek/llama-swap) + `/running` PR #474 | `/health` → plain `"OK"`; `/v1/models` `owned_by: llama-swap`; `/running` state `"ready"` |
| `llama-cpp-router` | [HF blog](https://huggingface.co/blog/ggml-org/model-management-in-llamacpp) + `test_router.py` | `/models` OAI list + `owned_by: llamacpp`; load/unload `{success:true}`; `/props.role=router` |

| Kind | Unit | Integration (dummy HTTP) |
| --- | --- | --- |
| `llama-swap` | `src/server/inference/backends/llama-swap.test.ts` | `src/test/inference-backends.integration.test.ts` |
| `llama-cpp-router` | `src/server/inference/backends/llama-cpp-router.test.ts` | same file, `describe.each` |
| factory | `src/server/inference/backend.test.ts` | — |

Shared path-dispatch dummies live in
`src/test/fixtures/dummy-inference-backend.ts`.

OpenAI-compatible inference paths exercised by the dummy:
`/v1/chat/completions`, `/chat/completions`, `/v1/completions`, `/v1/embeddings`,
`/v1/responses`, plus llama-swap Anthropic `/v1/messages` (+ `count_tokens`).

## Integration conventions

1. Seed via real admin APIs (`createApiKey`, `createRoutingRule`), not hand SQL.
2. Call `resetTestDatabase()` in `beforeEach` (wipes tables + caches + log queue).
3. Install fake upstream responses with `installFakeUpstream(...)`.
4. After a successful proxy call that streams a body, `await settleProxyResponse(response)`
   before asserting `requests` rows — completion logs are written when the body is drained.
5. Direct upstreams bypass the model scheduler; local targets go through it (batch window
   forced to `0` in the integration env).

## Cache invalidation

Admin modules cache routing rules, settings, aliases, and API keys. The harness calls
exported `invalidate*ForTest` / `invalidateKeyCache` after wiping tables so the next
test does not see stale in-memory state.
