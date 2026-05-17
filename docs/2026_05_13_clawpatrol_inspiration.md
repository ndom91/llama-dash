# Clawpatrol-Inspired Follow-Ups

Review source: https://github.com/denoland/clawpatrol

Clawpatrol is broader than llama-dash: it is an outbound MITM gateway for agent
traffic across HTTPS, SQL, Kubernetes, SSH, and other protocols. The tunneling,
TLS interception, device onboarding, and protocol plugin system are outside
llama-dash's current scope. The useful overlap is in gateway policy, secret
handling, dashboard feedback, and polling efficiency.

## 1. Upstream Credential Injection

Goal: clients authenticate to llama-dash with llama-dash API keys, while
provider credentials stay server-side and are injected only after a routing rule
selects a direct upstream.

Initial shape, shipped 2026-05-13:

- Add an encrypted upstream credential store in SQLite.
- Require `CREDENTIAL_ENCRYPTION_KEY` before creating or using stored secrets.
- Use Node's built-in `crypto` module with AES-256-GCM; avoid a dependency for
  the local encrypted-payload MVP.
- Store only encrypted payloads plus non-secret metadata.
- Never return secret values from admin APIs.
- Let direct routing rules reference a credential by ID.
- Inject the credential immediately before `fetch()` to the direct upstream.

Why built-in crypto first:

- It is maintained with Node and already available in our runtime.
- It works in Docker/server deployments where OS keychains are awkward.
- It keeps the threat model clear: encrypted-at-rest SQLite payloads protected by
  an operator-supplied environment key.

Future extensions:

- External secret references: `env:OPENAI_API_KEY`, Docker secrets, files, SOPS,
  1Password, HashiCorp Vault.
- Provider-specific OAuth flows.
- Richer per-credential usage summaries beyond the shipped `lastUsedAt` field.

## 2. Approval Mechanism

Goal: optionally gate selected requests behind an operator decision.

This is powerful but should not be the first implementation slice because proxy
requests are synchronous and clients may time out while waiting. A blocking
approval path also needs disconnect handling, timeouts, durable-ish pending
state, and clear UX for why a client request is hanging.

Possible staged approach:

- Start with non-blocking policy audit mode: log that a request would have
  required approval.
- Consider `reject_with_approval_link`: deny now, log the request, and let an
  operator replay or approve a follow-up action.
- Only later add a blocking routing action with explicit `timeoutMs` and
  `onTimeout: deny | allow` behavior.

If implemented, keep it as a routing action rather than a separate subsystem.

## 3. Dashboard Polling and SSE Refresh

Goal: reduce recurring dashboard polling overhead while keeping route-specific
endpoints separate.

Initial shape:

- Add `/api/state` or `/api/dashboard-state`.
- Bundle dashboard/shell data: health, GPU summary, running models, model
  timeline, recent requests, queue/system summary, and sidebar readouts.
- Hash the JSON payload and return `ETag`.
- Return `304 Not Modified` when `If-None-Match` matches.
- Keep route-specific heavy views on dedicated endpoints.

This is a performance cleanup and should be done after correctness-sensitive
credential work.

Shipped 2026-05-17:

- Keep separate route-specific endpoints instead of adding `/api/dashboard-state`.
- Keep conditional `ETag` support on successful JSON `GET /api/*` responses.
- Move live dashboard refresh to SSE-driven invalidation and keep request/model
  ETag polling as a slow fallback instead of the primary update path.
- Extend `/api/events` so it still passes through llama-swap log events and also
  streams llama-dash dashboard invalidation events.
- Publish invalidation events for request completion, model changes, GPU changes,
  and update-status changes; React Query uses them to refresh affected caches.
- Polling remains as a fallback when SSE disconnects or is unavailable.

## 4. Update Indicator

Goal: subtly surface when an upstream project has newer code available.

Initial shape:

- Check GitHub periodically from the server, cache for several hours, and expose
  the result in System or bundled dashboard state.
- Start with the selected inference backend upstream (`mostlygeek/llama-swap`).
- If the local backend reports a version or commit, compare it with GitHub's
  latest release or default-branch commit.
- Surface a small icon/dot next to the current version/commit in the sidebar or
  System page.
- Link to the relevant release or compare page.

Do not phone home with request, host, config, or API-key data. This should be a
one-way public GitHub check only.
