# Routing MVP Spec

## Goal

Add a first routing-policy system to `llama-dash` that lets operators control how requests are handled before they reach llama-swap / peer backends.

This feature should make `llama-dash` feel more like an operator-facing gateway, not just a passive proxy.

## Product Placement

Routing belongs under the existing **Policies** page, alongside:

- Aliases
- Request limits
- Routing

Routing is a governance/control surface, so it fits naturally in Policies rather than needing its own top-level nav item.

## User Problem

Operators want to express simple, explicit rules such as:

- for `/v1/messages`, prefer Anthropic peer routing
- for large prompts, reject early with a clear reason
- for a specific API key, route to a preferred backend
- for a requested model, rewrite or redirect to a compatible one
- if a request targets a model class, prefer local or peer backends

Today, `llama-dash` supports aliases and request limits, but not operator-defined routing behavior.

## Non-Goals

Not in MVP:

- complex boolean nesting (`AND`/`OR` groups)
- weighted load balancing
- provider cost optimization
- multi-rule composition
- dynamic metrics-driven routing
- full enterprise RBAC around who can edit routing
- automatic fallback retries during active streaming responses

## MVP Principles

### 1. Ordered rules

Rules are evaluated top-to-bottom.

### 2. First match wins

As soon as a rule matches, its action applies and evaluation stops.

### 3. Default behavior remains current behavior

If no routing rule matches, the current proxy pipeline continues unchanged.

### 4. One action per rule

Each rule has exactly one action in v1.

This keeps routing easy to reason about and easy to explain in the UI.

## Policy Model

Each routing rule has:

- `id`
- `name`
- `enabled`
- `order`
- `match`
- `action`

### Proposed shape

```ts
type RoutingRule = {
  id: string
  name: string
  enabled: boolean
  order: number
  match: RoutingMatch
  action: RoutingAction
}

type RoutingMatch = {
  endpoints?: string[]
  requestedModels?: string[]
  apiKeyIds?: string[]
  stream?: 'any' | 'stream' | 'non_stream'
  minEstimatedPromptTokens?: number | null
  maxEstimatedPromptTokens?: number | null
}

type RoutingAction =
  | { type: 'rewrite_model'; model: string }
  | { type: 'route_preference'; preference: 'local_first' | 'peer_first' | 'peer_only'; peerId?: string | null }
  | { type: 'fallback_chain'; models: string[] }
  | { type: 'reject'; reason: string }
```

## Match Conditions

### Endpoint

Initial support:

- exact endpoint strings

Examples:

- `/v1/chat/completions`
- `/v1/messages`

No regex or wildcard support in MVP.

### Requested model

Initial support:

- exact model names

Examples:

- `gpt-4o`
- `claude-sonnet-4-6`
- `gemma-4-27b`

No globbing in MVP.

### API key

Match by stored key ID, not raw token.

This should map naturally to the existing API key admin surface.

### Stream / non-stream

Three states:

- `any`
- `stream`
- `non_stream`

### Estimated prompt size

MVP should use **estimated prompt tokens**, not raw bytes.

Rationale:

- operators care about model pressure more than HTTP payload bytes
- token-ish size better predicts context issues and routing intent

The match should support:

- min estimated prompt tokens
- max estimated prompt tokens

## Actions

### 1. Rewrite model

Rewrites the requested model before forwarding.

Example:

- incoming requested model: `gpt-4o`
- rewritten model: `claude-sonnet-4-6`

This is distinct from global aliases because it is conditional.

### 2. Route preference

Expresses backend preference without necessarily changing the model name.

Initial options:

- `local_first`
- `peer_first`
- `peer_only`

Optional:

- `peerId`

Examples:

- prefer local if available
- prefer peer for `/v1/messages`
- force peer `anthropic`

### 3. Fallback chain

Defines an ordered list of fallback models.

Example:

```json
{ "type": "fallback_chain", "models": ["claude-sonnet-4-6", "claude-haiku-4-5"] }
```

### Important MVP constraint

Fallback should only trigger for clearly retryable pre-forward or upstream-availability failures.

In MVP, fallback should apply to cases like:

- requested model unavailable
- peer/backend unavailable
- load/routing failure before response body streaming begins

Fallback should **not** attempt mid-stream retry.

### 4. Reject

Reject the request with a policy-defined reason.

Example:

- `Large prompts are not allowed on this endpoint`

This should surface clearly in request logs and request detail.

## Routing Evaluation Semantics

### Pipeline placement

Routing should happen in the proxy request-processing pipeline after:

- auth
- request parsing
- request size estimation

And before final upstream forwarding.

It should fit near existing transform logic rather than becoming a separate totally independent flow.

### Evaluation order

For each request:

1. parse request
2. derive match context
3. evaluate routing rules in order
4. apply first matching rule action
5. continue with remaining forwarding flow

If no rules match, continue with current behavior.

### Match context fields

The rule engine should derive a lightweight context object like:

```ts
type RoutingContext = {
  endpoint: string
  requestedModel: string | null
  apiKeyId: string | null
  stream: boolean
  estimatedPromptTokens: number | null
}
```

## UI Spec

### Policies page

Add a third section/tab under Policies:

- Aliases
- Request Limits
- Routing

### Routing list UI

Show rules in execution order.

For each rule show:

- name
- enabled/disabled
- compact match summary
- compact action summary
- controls to move up/down
- edit/delete actions

### Routing rule readability

The list UI should read like plain English.

Example:

- **When** endpoint is `/v1/messages`, stream is `stream`, requested model is `claude-*`
- **Then** prefer peer `anthropic`

Or:

- **When** estimated prompt tokens > `16000`
- **Then** reject: `Prompt exceeds local routing policy`

### Rule editor

Simple form:

- name
- enabled
- match block
- action block

No advanced expression builder in MVP.

### Empty state

Explain clearly:

- rules are ordered
- first match wins
- no match means current default behavior

## API / Persistence

Add a new routing policy store.

Likely shape:

- new DB table for routing rules
- ordered rows
- JSON columns or structured columns depending on simplicity

Need admin API endpoints for:

- list rules
- create rule
- update rule
- delete rule
- reorder rules

## Observability

Request detail should show routing outcomes for requests affected by a rule.

Minimum fields to expose:

- matched routing rule ID / name
- action type applied
- resulting routed model / peer preference
- reject reason if rejected

This is important so routing does not become opaque.

## Suggested Delivery Phases

### Phase 1

- ordered rule storage
- match by endpoint / model / key / stream / estimated prompt tokens
- actions:
  - rewrite model
  - route preference
  - reject
- Policies UI section
- request detail visibility for matched rule

### Phase 2

- fallback chain
- stronger routed-request diagnostics
- richer model matching (patterns or aliases)

## Open Questions

1. Should fallback be in MVP or Phase 2?
2. Should requested model matching include aliases or only raw requested model?
3. Should route preference target only peer/local classes, or specific peer IDs from day one?
4. Should reject reasons be operator-visible only, or returned directly to clients as-is?

## Recommendation

For implementation discipline, start with:

- rewrite model
- route preference
- reject

and explicitly phase fallback chains next.

That gives `llama-dash` real routing power without overcomplicating failure semantics in v1.
