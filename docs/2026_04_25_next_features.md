# Next Feature Roadmap

This roadmap focuses on features that make llama-dash the best homelab LLM
operator dashboard/proxy: local-model aware routing, safe observability,
operator notifications, and practical recovery tools.

## Guiding Principles

- Prefer homelab/operator value over enterprise SaaS breadth.
- Build visibility before automation. Operators should see system state before
  llama-dash starts making more autonomous decisions.
- Keep proxy behavior explicit and debuggable. Routing/fallback decisions should
  be visible in request logs.
- Keep privacy controls first-class. Prompt/body capture should be intentional,
  bounded, and redactable.
- Ship features in small vertical slices that fit the existing proxy/admin/UI
  boundaries.

## Priority 1: System Visibility Foundation

These features unblock safer automation and make recent internals observable.

### 1. System Page

Add a small `/system` page backed by `/api/system`.

Initial contents:

- Log queue stats: queued, dropped, last write error, last flush time.
- Database status: path, WAL mode, recent write latency if available.
- Proxy status: configured upstream, health, latency, direct target allowlist.
- Runtime status: process uptime, version/build info, Node version.
- GPU poller status: backend type, last successful poll, last error.
- Model watcher status: last poll, last change, last error.

Technical notes:

- Start read-only.
- Reuse existing health, GPU, and queue state instead of adding new pollers.
- Add a nav item only once the page has more than queue stats.

### 2. Prometheus Metrics Endpoint

Expose `GET /metrics` in Prometheus text format.

Initial metrics:

- Request counters by endpoint, model, status class, key id/name where safe.
- Token counters by model and key.
- Latency histogram.
- Current running model count.
- GPU memory/util/temp/power gauges when available.
- Log queue queued/dropped gauges/counters.
- Upstream health and latency gauges.

Technical notes:

- Keep label cardinality low. Avoid raw session IDs, end-user IDs, and request IDs.
- Prefer aggregate DB queries or in-memory counters for hot-path metrics.
- Do not block proxy traffic on metrics collection.

Why first:

- Adds operational confidence.
- Gives alerting integrations a clean data source later.

## Priority 2: Privacy Controls

These should land before expanding tracing/session forensics further.

### 3. Global Body Capture Policy

Add settings for request/response body capture.

Policy modes:

- `off`: never capture request/response bodies.
- `errors_only`: capture bodies only when status >= 400 or proxy error occurs.
- `all`: current behavior, bounded by existing byte limits.

Additional controls:

- Separate request and response body capture toggles if needed.
- Preserve current max-byte truncation settings.
- Show capture policy in request detail when bodies are absent due to policy.

Technical notes:

- Implement in `src/server/proxy/log.ts` or immediately before log enqueueing.
- Keep recent in-memory body cache consistent with DB capture policy.
- Avoid parsing or redacting bodies when capture is disabled.

### 4. Redaction Rules

Add configurable redaction patterns before storing bodies.

Initial rule type:

- Regex pattern + replacement string.
- Apply to request body and response body independently.
- Apply before DB truncation and before recent-body cache storage.

Technical notes:

- Validate regexes on write.
- Limit rule count and pattern length to avoid runaway CPU cost.
- Consider timeout-free JavaScript regex risk; keep admin warning copy explicit.
- Log whether redaction was applied without storing matched values.

### 5. Per-Key Capture Policy

Extend API keys with an optional body capture override.

Examples:

- Personal debugging key: capture all.
- Shared/Home Assistant key: errors only.
- Sensitive Claude Code key: off.

Technical notes:

- Global policy remains default.
- Key-specific policy overrides global only when set.
- Request logs should record effective capture policy for explainability.

## Priority 3: Reliability Routing

This builds on existing ordered routing rules and direct target support.

### 6. Per-Rule Timeout

Add optional timeout to routing rules.

Behavior:

- If matched rule defines timeout, proxy aborts upstream fetch after N ms.
- Timeout appears in request logs as routing/proxy error metadata.
- Timeout can trigger fallback once fallback routing exists.

Technical notes:

- Use `AbortController` in `forwardUpstreamAndLog()`.
- Preserve streaming behavior; timeout should abort active stream too.
- Include timeout config in routing rule preview and request detail.

### 7. Retry and Fallback Routing Rules

Add explicit fallback behavior to routing rules.

Initial shape:

- Primary action/target remains as-is.
- Optional fallback list with target/action/model overrides.
- Trigger conditions: network error, timeout, 5xx, optionally 429.
- Max attempts capped globally and per rule.

Useful scenarios:

- Local model times out -> fallback to smaller local model.
- Local upstream down -> fallback to direct Anthropic/OpenAI.
- Direct provider 429 -> fallback to local model or alternate provider.

Technical notes:

- Log each attempt in request detail, not just final outcome.
- Keep body reuse constraints in mind; buffered JSON bodies are easy, streaming
  request bodies may not be retryable.
- Start with JSON/non-multipart requests only if needed.
- Preserve explicit auth behavior for each fallback target.

### 8. Health-Aware Routing

Avoid known-bad upstreams/models during routing.

Health signals:

- llama-swap `/health`.
- direct upstream probe or recent failure rate.
- model running state from `/running`.
- recent timeout/error rate per model/target.

Behavior:

- Add rule option: skip unhealthy candidates.
- Request detail should explain skipped candidates.
- System page should show current health state and recent reason.

Technical notes:

- Use cached health state with short TTL.
- Do not probe providers on every request.
- Define conservative initial health model: healthy, degraded, unhealthy,
  unknown.

## Priority 4: Homelab-Aware Model Selection

This is the most differentiating feature and should build on visibility and
health state.

### 9. Prefer Loaded / Best Loaded Model Routing

Add routing action/strategy for selecting among allowed models based on local
state.

Strategy examples:

- Prefer an already-loaded model from a configured candidate list.
- Choose the largest currently loaded model that matches a policy.
- Choose the lowest-latency loaded model from recent observations.

Inputs:

- Candidate model list.
- Required context window or estimated prompt-token range.
- Optional model tags/classes, if available from config.
- Per-key allowed models.

Technical notes:

- Start with loaded-state only. Add VRAM-fit later.
- Log selected model and skipped candidates.
- UI should preview decision factors.

### 10. VRAM-Fit-Aware Routing

Choose the best model that can fit current GPU memory and policy.

Inputs:

- GPU free/used memory from poller.
- Model memory estimates from config, observed load, or manual metadata.
- Candidate models and key/model allow-lists.

Behavior:

- Prefer already-loaded model if suitable.
- If nothing loaded fits policy, choose loadable model by configured ranking.
- Avoid triggering loads that are likely to exceed VRAM.

Technical notes:

- Requires model metadata. Start with manual per-model memory estimate settings.
- Later infer from observed load events/GPU deltas.
- Keep decisions explainable in request detail.

## Priority 5: Notifications

Notifications should use the System/Metrics foundation rather than inventing a
parallel monitoring path.

### 11. Notification Destinations

Start with simple destination types:

- Generic webhook.
- ntfy.
- Gotify.

Technical notes:

- Store destination config in settings.
- Include test-send action in UI.
- Avoid secrets in request logs and settings responses.

### 12. Alert Rules

Initial alerts:

- Upstream unavailable.
- Direct target unavailable or repeated failure.
- GPU VRAM above threshold.
- Model load/unload flapping.
- Error rate spike.
- p95 latency spike.
- Log queue dropped logs > 0.

Technical notes:

- Keep alert state in memory initially: firing/resolved, last sent, cooldown.
- Add persistence later if needed.
- Use System page to show alert state.

## Priority 6: Config Change History

This improves operator confidence around the config editor.

### 13. Config Revisions

Persist config save history.

Revision data:

- Revision ID and timestamp.
- User/source if admin auth ever exists.
- Previous content hash and new content hash.
- Validation result.
- Backup file path if applicable.

Technical notes:

- Store full revision content or compressed content in SQLite only if acceptable.
- Alternatively store backup file references plus metadata.
- Keep atomic write + backup behavior unchanged.

### 14. Diff Viewer and Rollback

Add UI for revision comparison and rollback.

Behavior:

- View current vs previous diff.
- View any revision vs current.
- Roll back by writing selected revision through the same validate/save path.
- Show whether llama-swap has observed the reload after rollback.

Technical notes:

- Rollback should not bypass validation.
- Preserve comments/key order by reusing current YAML write path.
- Record rollback as a new revision.

## Suggested Build Order

1. System page with log queue/status internals.
2. Prometheus `/metrics` for request/GPU/queue/upstream health.
3. Global body capture policy.
4. Redaction rules.
5. Per-key capture policy.
6. Per-rule timeout.
7. Retry/fallback routing for buffered requests.
8. Health-aware routing state and UI explanation.
9. Prefer-loaded model routing.
10. VRAM-fit-aware routing with manual model memory metadata.
11. Notification destinations and alert rules.
12. Config revisions, diff viewer, rollback.

## Open Product Questions

- Should `/metrics` expose API key IDs, key names, both, or neither by default?
- Should body capture default to `all` for backwards compatibility or `errors_only`
  for privacy-first installs?
- Should redaction rules apply to headers as well as bodies?
- Should fallback attempts be logged as one request row with attempt metadata, or
  multiple linked request rows?
- Where should model memory estimates live: llama-swap config annotations,
  llama-dash DB settings, or inferred-only?
- Should notifications be global-only at first, or configurable per alert rule
  from the beginning?
