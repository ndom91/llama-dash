# Architecture Audit

This note captures a zoomed-out audit of the current llama-dash architecture,
with recommendations focused on maintainability, security, and performance.

## Top Priorities

1. Add admin/API authentication.

   `src/server.ts` sends every `/api/*` request directly to
   `handleAdminRequest()` with no auth gate. That exposes API-key creation and
   revocation, routing rules, config editing, model load/unload, logs, and
   request details to anyone who can reach the UI port.

   Recommended minimal fix: add an `ADMIN_TOKEN` or reuse system API key auth
   for `/api/*`, with local-dev opt-out only when explicitly configured.

2. Add passthrough rule guardrails.

   A broad `passthrough` + `preserveAuthorization` + direct target rule can turn
   llama-dash into a public bearer-token relay if exposed. The implementation is
   explicit, which is good, but it needs safety rails.

   Recommended fixes: require at least one endpoint matcher for passthrough
   direct rules, warn/block “match everything” passthrough rules, and add a
   visible danger state in the Policies UI.

3. Stop buffering full non-SSE responses in proxy forwarding.

   `src/server/proxy/forward.ts` accumulates all decoded JSON/text response
   chunks in `responseChunks` so it can parse usage and log response bodies.
   Large JSON responses can create memory pressure.

   Recommended fix: cap accumulated response bytes for logging/usage parsing,
   or only parse JSON usage up to a bounded limit. Forwarding should remain
   streaming.

4. Add body-size limits before full buffering.

   `src/server/proxy/body.ts` reads complete non-multipart bodies into memory.
   Auth-first reduced exposure for invalid key-auth requests, but valid or
   body-dependent passthrough requests can still send very large bodies.

   Recommended fix: enforce a hard max read size during `readBody()` and
   multipart parsing, separate from “estimated token” policy.

## Security

5. Limit direct upstream hostnames.

   Direct upstream validation requires HTTPS and `/v1`, but any HTTPS host is
   allowed. That is flexible but opens SSRF-style risk from admin compromise or
   misconfiguration.

   Recommended fix: optional allowlist setting for direct upstream hosts, with
   UI validation and server enforcement.

6. Make passthrough rate limiting explicit.

   Passthrough auth skips llama-dash key enforcement and therefore skips per-key
   RPM/TPM. That is documented, but operationally risky for direct upstreams.

   Recommended fix: add optional per-routing-rule RPM limits keyed by
   route/client header/IP fallback, or at least global passthrough RPM.

7. Hide sensitive direct target URLs from request list by default.

   `routingTargetBaseUrl` is logged and shown. That is useful, but direct URLs
   can encode organizational or provider info.

   Recommended fix: store host-only in list rows, full URL in detail only, or
   redact path beyond `/v1`.

8. Consider admin CSRF protection if browser-auth is added.

   Once admin auth uses cookies, mutation endpoints need CSRF protection. If
   using bearer-only admin auth, this is less urgent.

## Performance

9. Add SQLite indexes for common request queries.

   `requests` queries filter/order by `id`, `startedAt`, `keyId`, `model`, and
   status/time windows. The primary key helps cursor pagination, but dashboard
   stats and histograms scan recent windows.

   Recommended indexes: `requests(started_at)`, `requests(key_id, id)`, maybe
   `requests(model, id)` and `model_events(timestamp)`.

10. Avoid repeated API-key list reads for request lists.

    `listRecentRequests()` calls `listApiKeys()` to build a key map. Fine now,
    but this grows with key count and every poll.

    Recommended fix: small in-memory key-name cache invalidated on key
    mutations, or join/select only needed IDs.

11. Bound recent full-body memory by bytes, not count.

    `recent-bodies.ts` stores the last 100 full bodies. A few huge bodies can
    dominate memory.

    Recommended fix: use a byte-budget LRU, for example 10-50 MB total, not a
    fixed count.

12. Split usage parsing from response body logging.

    Forwarding currently combines “capture response text” and “extract usage.”
    Long term, usage extraction should be a bounded scanner independent of body
    logging.

## Maintainability

13. Formalize proxy pipeline stages.

    The proxy files are cleaner now, but `handler.ts` still manually sequences
    auth, body prep, transforms, upstream selection, auth header stripping, and
    forwarding.

    Recommended next step: introduce a small `ProxyContext` object or pure stage
    functions:
    `createProxyContext()`, `authenticateProxyContext()`,
    `prepareBodyIfNeeded()`, `applyProxyTransforms()`, and
    `forwardProxyContext()`.

    This would make tests easier and reduce accidental ordering regressions.

14. Move routing match field metadata into one place.

    `hasBodyDependentPreAuthRoutingRule()` must stay in sync with routing match
    fields. This is currently documented in `AGENTS.md`, but still manual.

    Recommended fix: define match-field metadata near the schema, for example
    `{ field, requiresBodyForPreAuth }`.

15. Add integration-style tests around handler ordering and streaming.

    The current `handler.test.ts` is useful. Add cases for:

    - broad passthrough rejected/warned if guardrails are added
    - direct target URL construction with query strings
    - client disconnect logging
    - large JSON response bounded capture
    - body max-size rejection

16. Introduce admin route grouping.

    `admin/handler.ts` is a large route table. It is still manageable, but it
    mixes models, config, requests, routing, settings, and keys.

    Recommended future split: keep the central router, move route arrays into
    feature modules like `admin/routes/requests.ts` and `admin/routes/routing.ts`.

## Lower Priority

17. Persist or document rate-limit reset semantics.

    RPM/TPM are in-memory and reset on restart. That is okay for single-box MVP,
    but should be visible in UI/docs.

18. Add operational health for DB writes.

    Proxy logging writes synchronously to SQLite at completion. If SQLite
    stalls, request completion can be affected.

    Recommended future option: async logging queue with bounded backlog and a
    “dropped logs” counter.

19. Update README wiring docs.

    README still mentions `src/server/vite-plugin.ts`, which appears stale.
    `AGENTS.md` has already been updated; README should be synced eventually.

## Suggested Sequence

1. Add admin auth.
2. Add passthrough guardrails.
3. Bound body and response capture.
4. Add SQLite indexes.
5. Then revisit proxy pipeline staging and admin route grouping.
