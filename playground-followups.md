# Playground rebuild — followups

Stubs, shortcuts, and deferred work from the three-column Playground rebuild
(commit `d4956e1`). Grouped by surface.

## Model metadata

- **Context length hardcoded** — `ctx 32K` in the model-status strip and the
  inspector ACTIVE MODEL grid is a literal string. `/api/models` does not
  currently return `context_length`. Needs an API addition (llama-swap
  exposes it per-model) and both surfaces updated to read from it.
- **Model `kind`** in the strip reads from the list endpoint; the detail
  route (`/api/models/:id`) is richer but not used here.
- **`max_tokens` slider max is 8192** — should clamp to the active model's
  context length instead of a fixed ceiling.

## Sampling / request surface

- **Non-streaming path not validated** — `sampling.stream=false` is sent
  through but the hook still iterates the async generator. Needs a
  JSON-response code path when stream is disabled.
- **`n > 1` (multiple choices)** — param is sent, but only
  `choices[0].delta` is read during streaming. No UI to view the other
  completions.
- **`logprobs`** — toggle is plumbed to the request body but the response
  is not rendered anywhere. Needs per-token logprob display in the
  assistant bubble.
- **`response_format: json`** — sent as `{ type: 'json_object' }` but no
  JSON-schema editor, no client-side validation, and the Response tab
  renders as plain text (not prettified/highlighted JSON).
- **Tools / tool_choice / json_schema** — rendered in the session rail as
  read-only rows (`0 defined`, `auto`, `—`). No editor, not wired into the
  request body.
- **Seed** — text input only; no "randomize" button to mint a fresh seed
  for reproducibility testing.
- **Stop sequences** — chips work, but escape handling is display-only
  (`\n` rendered as literal). Actual sequence stored as-is.

## Metrics / cost

- **Cost is always `~$0.0000`** — no pricing table exists. Needs a
  per-model cost config (input/output $/M tokens) and a computed `costUsd`
  at stream completion.
- **`gpt-tokenizer` is model-agnostic** — used for the "tokens in" counter.
  Fine as an estimate; off for non-GPT tokenizers (Llama, Gemma, Qwen, …).
  If accuracy matters later, swap in a model-specific tokenizer or call an
  upstream `/tokenize` endpoint.
- **Usage extraction depends on the final SSE chunk** — llama.cpp emits
  `usage` in the last data block, but not every backend does. If missing,
  `tokIn`/`tokOut`/`tokPerSec` stay undefined and the metric chips show
  `—`. No fallback estimate from the tokenizer.
- **Observation card** is a simple template string (`ttft Xms. Run
  completed.`). The mockup implies a comparison against rolling history
  ("12% over 7-day average"). No history store or rolling stats exist yet.

## Timing bars

- **Queue + model-swap bars are stubbed** — rendered with a diagonal
  stripe pattern because llama-swap doesn't expose those numbers to the
  client today. Needs proxy-side instrumentation (a `queue_start`/`queue_end`
  + `swap_start`/`swap_end` timestamp set) and a new endpoint or an
  extended request-completion payload.
- **`stream close`** duration is never captured. The hook sets
  `streamCloseMs: null` — we'd need a post-`DONE` timestamp vs. connection
  close.
- **`prefill` = ttft** — approximation. True prefill ends slightly before
  the first token is delivered over SSE. Good enough for now; revisit if we
  pipe server-side timings through.

## Event tape

- Tags emitted: `REQ`, `MDL`, `PFL`, `DEC`, `RSN`, `STOP`, `RES`, `ERR`.
- **Missing from mockup**: `KV allocated 812 MB kv-cache`, `STOP hit
  max_tokens? no · natural end`, distinct `res 200 ok · 412 tok · 4.74s`
  line. Needs KV-alloc event from upstream and a richer finish-reason
  formatter.

## Inspector tabs

- **Request tab** shows only the last request body. No history browser, no
  way to diff two consecutive requests.
- **Response tab** renders as plain `<pre>`. No JSON highlight when
  `response_format=json`, no reasoning toggle.
- **cURL generator** — basic string build. Doesn't rigorously escape every
  shell special in the body beyond single-quote handling. Doesn't include
  `--no-buffer` for streaming. Doesn't round-trip tested.
- **Copy button** — present on Request, Response, cURL; missing on Timing
  and Events (minor).

## Presets / saved runs

- **localStorage only** — no server-side persistence, no export/import,
  no sharing, no sync across browsers.
- **Preset name collisions** not checked; duplicate names allowed.
- **No preview** — dropmenu shows `model · t=0.70` subtitle only. No full
  sampling diff on hover.
- **Saved runs** store the full message array. No size budget; will
  silently hit the localStorage quota on large chats.

## Interaction stubs

- **`+ attach` button** — disabled, tooltip only. No file upload path.
- **`/ command` button** — disabled, tooltip only.
- **`var: ${path}`** label in the toolbar is literal display text. No
  variable substitution engine.
- **`/` prompt library shortcut** — hint shown in the keyboard footer, no
  binding.
- **`r` send & re-run shortcut** — hint shown, no binding.
- **`Run all`** button — disabled; compare mode deferred entirely.

## Fork semantics

- **"Fork" truncates to the clicked message** — it does not create a
  separate branch or saved run. There is no branch tree model. Re-labelling
  the action or implementing actual branches is a followup.

## Responsive

- **Right rail (inspector) hidden below 1200px viewport** — no mobile
  story.
- **Left rail (session) hidden below 900px viewport** — no mobile story,
  so sampling/system-prompt become inaccessible on narrow screens.
- **`.pg-page` mobile tweaks** hide the `page-header` entirely on
  `max-width: 768px` — predates this rebuild but worth re-checking.

## Global layout (out of scope, queued)

- **Sidebar redesign** (mockup uses `DSH`/`REQ`/`MDL`/… semantic codes,
  no icons, no VRAM/theme footer) — not started; planned in a separate
  pass.
- **Breadcrumb-style kicker** across all routes — not started.
- **TopBar datetime format** tweak to `2026 · 04 · 20 · hh : mm : ss`
  dot-spaced — not started.
- **Logo** swap from phosphor bar to literal underscore char — not
  started.
