# Single-pass routing + optimistic key auth

## Problem

Routing used to run in **two passes**:

1. **Pre-auth pass** (`evaluatePreAuthRouting`) — before key auth, evaluating only
   rules that were `passthrough` **and** had no API-key matcher **and** used no
   stored credentials. If one matched, auth was skipped entirely (`keyId` stayed
   `null`).
2. **Post-auth pass** (inside `applyTransforms`) — full rule evaluation with the
   resolved API key.

This broke the UI's promise that rules are **ordered, first-match-wins**. An
endpoint-only `passthrough` rule (e.g. "Anthropic passthrough" matching
`/v1/messages`) always shadowed any earlier `require_key` rule on the same
endpoint, because the earlier rule was filtered out of the pre-auth pass. Worse,
once the pre-auth passthrough matched, the API key was never resolved, so a
later `require_key` rule with an API-key matcher could not match in the
post-auth pass either.

Concrete failure: a rule ordered above "Anthropic passthrough" that rewrote
`claude-haiku-*` → a local model for a specific key never fired; the request was
forwarded to Anthropic with the client's token and 401'd.

## Fix: one ordered pass with optimistic key resolution

`handler.ts` now:

1. **`resolveApiKey(request)`** — looks up the bearer token (header-only, no body
   read). A missing/unknown/revoked/expired token is reported as `absent`/
   `invalid` rather than rejected up front.
2. **`prepareBodyForRoutingIfNeeded(ctx, resolvedKeyId)`** — reads the body only
   when `proxyRoutingNeedsBody()` says a still-matchable rule constrains on a
   body-derived field (model / stream / token estimate). `require_key` rules only
   trigger this pre-enforcement read once a valid key is resolved (or the proxy
   runs open with no keys), so unauthenticated requests are still rejected
   without buffering a body.
3. **`resolveProxyRouting(...)`** — a single ordered, first-match-wins evaluation
   with the resolved key id.
4. **`enforceAuth(keyResolution, decision.authMode)`** — the matched rule's auth
   mode governs enforcement: `passthrough` never requires a llama-dash key (the
   client owns the upstream Authorization); `require_key` (and the no-rule
   default) demands a valid, active, in-quota key when any user keys exist.
5. **`applyTransforms(..., { routingDecision })`** — applies the already-decided
   rule (rewrite / reject / alias / system prompt / limits). It no longer
   evaluates rules itself, so enforcement and transforms always agree.

### Behavior matrix

| Bearer token            | Model  | Result                                              |
| ----------------------- | ------ | --------------------------------------------------- |
| valid llama-dash key    | haiku  | key-scoped `require_key` rewrite rule wins → local  |
| Anthropic OAuth token   | haiku  | key rule can't match → passthrough → Anthropic      |
| Anthropic OAuth token   | opus   | passthrough → Anthropic                             |

## Allow-list applies to the effective model

`applyTransforms` previously checked the per-key model allow-list **twice** —
before and after a routing rewrite — so a key had to allow-list both the
requested and the rewritten model. That defeated rewrite rules: a key routed
from `claude-haiku-*` to a local model had to allow-list `claude-haiku-*` it
never actually ran. The pre-rewrite check was removed; the allow-list now
governs only the **effective (post-rewrite) model** that will actually be
served.

## Notes / follow-ups

- Key-id vs. name: routing rules store API-key **ids**. Two keys sharing a
  display name are indistinguishable in the rule editor's names-only dropdown, so
  a rule can point at a different key than the one a client authenticates with.
  Consider disambiguating the dropdown (short id suffix) if this recurs.
- Removed: `evaluatePreAuthRouting`, `evaluatePreAuthRoutingRules`,
  `hasBodyDependentPreAuthRoutingRule`, `preferPostAuthRouting`, and
  `TransformContext.skipRouting`. Added: `resolveApiKey`, `enforceAuth`,
  `resolveProxyRouting`, `proxyRoutingNeedsBody`, `routingNeedsBody`.
