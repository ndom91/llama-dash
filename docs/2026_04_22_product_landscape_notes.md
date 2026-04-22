# Product Landscape Notes

This note captures a lightweight product-manager-style review of adjacent LLM proxy / gateway / observability products and how their public feature demand maps onto `llama-dash`.

## Research Base

Public signal sources reviewed:

- `BerriAI/litellm`
- `Helicone/helicone`
- `open-webui/open-webui`

The goal was not to mirror their roadmaps directly, but to identify recurring categories of user demand:

- routing and fallback control
- auth and key-management edge cases
- budgeting and spend attribution
- observability beyond raw logs
- tool / MCP / structured-output compatibility
- better admin/operator ergonomics

## What Users Keep Asking For

### 1. Smarter routing

Common asks:

- custom routing rules
- fallback for unsupported model versions
- provider-specific parameter translation
- structured-output compatibility
- reasoning / tool-call compatibility
- better visibility when requests are rewritten

This was especially visible in LiteLLM issues.

### 2. Budgeting and attribution

Common asks:

- org / team / user / end-user spend attribution
- budget reset windows
- quotas that behave correctly with cached tokens and team keys
- clearer cost accounting and overrides

This was also very strong in LiteLLM and Helicone discussions.

### 3. Operational observability

Common asks:

- sessions / traces / grouped request flows
- alerts
- richer analytics beyond raw logs
- cost and token analysis operators can trust

Helicone and Open WebUI both point strongly in this direction.

### 4. Tool / MCP compatibility

Common asks:

- MCP passthrough
- user-specific MCP headers
- tool translation quirks across providers
- automations losing tool availability
- reasoning / tool-call compatibility bugs

This category appears to be growing in importance quickly.

### 5. Admin ergonomics

Common asks:

- richer admin dashboard
- workspace or model access control
- configurable auth header behavior
- file upload / size / policy controls
- fewer hidden edge cases in key / team management

### 6. Prompt / workflow management

Common asks:

- prompt management with environment / user tracking
- playground improvements
- AI workflows / automations / data sources
- eval labeling / quality scoring

This is more "platform" than "proxy", but it is where adjacent products often expand.

## What llama-dash Already Covers Well

Current strengths:

- self-hosted gateway / proxy
- request logs
- model load / unload lifecycle
- API keys
- quotas / request limits
- aliasing / default models / system prompt injection
- dashboard visibility for running models, GPU, and request stats
- request-detail inspection
- good playground / operator UX

That means `llama-dash` is already beyond the basic gateway feature set. The main gaps are around operator control, routing intelligence, and higher-level observability.

## Best Missing Features For llama-dash

### High Fit

These align well with the current product shape and repo goals.

#### 1. Routing policies

Examples:

- explicit fallback chains
- conditional routing by model / endpoint / key / request size
- local-vs-peer preference rules
- rules like "if tools + reasoning, route to peer X"

Why it fits:

This is one of the most requested gateway capabilities and maps directly onto the proxy layer.

#### 2. Budget periods and alerting

Examples:

- daily / weekly / monthly quota reset windows
- per-key alerts near quota exhaustion
- admin alerts for repeated upstream failures or 4xx / 5xx spikes
- optional webhook / Slack notifications

Why it fits:

`llama-dash` already has quotas and keys; users tend to want these to behave like real operational controls rather than static limits.

#### 3. Better attribution

Examples:

- end-user / client / app tagging
- per-key + per-model + per-end-user breakdown
- "who caused this spend?"
- request grouping by session / conversation / client trace ID

Why it fits:

This is likely the biggest observability gap relative to Helicone / LiteLLM.

#### 4. Compatibility / translation matrix

Examples:

- better provider-specific request transforms
- structured-output compatibility
- tool-call compatibility
- reasoning-mode compatibility
- MCP / tool passthrough clarity

Why it fits:

Users care less that a gateway exists than that it makes heterogeneous backends feel reliable.

#### 5. Operator alerting / health

Examples:

- upstream degradation alerts
- model stuck-loaded / swap-thrashing detection
- repeated auth failures
- queue / latency / error anomaly detection

Why it fits:

This would make `llama-dash` feel more like a serious operator console.

### Medium Fit

Useful, but one layer above the current core.

#### 6. Prompt management

Examples:

- reusable prompt templates
- key-scoped prompt bundles
- environment-specific prompts
- versioned system prompts

#### 7. Request / session grouping

Examples:

- connect multiple requests into a conversation or workflow trace
- useful for agent runs and Claude Code-like clients

#### 8. Saved investigations / dashboards

Examples:

- saved request filters
- saved model / key drilldowns
- quick incident views

### Lower Fit / Risky Expansion

These are common asks in adjacent products, but they start to pull `llama-dash` into a different category.

#### 9. Full evals / QA platform

- labeling
- scoring
- experiment dashboards
- datasets

#### 10. Workflow builder / automations

- AI workflows
- no-code automations
- data sources / knowledge base

#### 11. Enterprise identity / team hierarchy

- SSO
- org / team RBAC
- multi-workspace administration

These are real market asks, but they risk turning `llama-dash` into a much larger product than the current goals suggest.

## Suggested Prioritization

### Tier 1

1. Routing policies + fallback chains
2. Budget reset periods + alerts
3. End-user / session attribution

Why:

This trio most directly improves `llama-dash` as an operator-facing gateway.

### Tier 2

4. Provider / tool / reasoning compatibility layer
5. Operational alerts and incident-friendly dashboards
6. Request / session grouping

### Tier 3

7. Prompt management
8. Saved investigations
9. Limited webhook ecosystem

## Concrete Feature Ideas

### 1. Fallback routing policy editor

Examples:

- if model unavailable -> try alias / fallback model
- if endpoint is `/v1/messages` with tools -> route to peer X
- if request too large -> reject or reroute

### 2. Quota windows

Examples:

- per-key monthly reset
- daily token budget
- rolling RPM / TPM plus reporting window

### 3. Alert rules

Examples:

- error rate > X
- upstream latency > Y
- model load / unload churn > Z
- budget at 80 / 95 / 100%

### 4. Session attribution

Support headers like:

- `x-end-user-id`
- `x-session-id`
- `x-client-name`

Then filter and aggregate by them in the requests UI.

### 5. Compatibility inspector

On request detail, show:

- alias rewrite
- routed upstream
- transforms applied
- params dropped / translated
- why routing decision happened

### 6. Session / trace view

Group requests by `session_id`.

Useful for:

- agent loops
- retries
- tool calls
- Claude Code sessions

### 7. Webhook notifications

Examples:

- budget threshold crossed
- upstream down
- auth failures spike
- new key created / revoked

## Product Take

The strongest opportunity is not "be another chat UI".

The strongest opportunity is:

**Be the best operator console for a self-hosted multi-model gateway.**

That suggests:

- go deeper on routing
- go deeper on budgets / alerts
- go deeper on attribution and compatibility
- avoid drifting too far into evals / workflow-builder / SaaS-admin territory unless the product direction intentionally changes

## Summary

The next best-fit roadmap themes for `llama-dash` are:

1. routing policies
2. budget windows and alerts
3. end-user / session attribution
4. compatibility / translation visibility
5. operator health and incident tooling

The largest adjacent opportunities exist in evals, workflows, and enterprise identity, but those should be treated as category expansion rather than obvious near-term roadmap work.
