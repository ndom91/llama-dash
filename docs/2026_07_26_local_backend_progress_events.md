# Upstream-forced streaming + client-faithful responses

## Idea

Keep the **client ↔ llama-dash** contract honest (`stream: true|false` as
requested), but for local completion endpoints always talk to the inference
backend with `stream: true`. That gives llama-dash full SSE phase timing
(REASON/RESPOND, GPU timings, token usage) for every chat/completion request.

When the client asked for non-stream JSON, drain the upstream SSE, assemble an
OpenAI/Anthropic-compatible completion object, and return that JSON once the
stream finishes — with queue + phase offset **headers** and a sibling
`timings_llama_dash` object on the JSON body (alongside upstream llama.cpp
`timings`, not merged into it):

| Header | Meaning |
|--------|---------|
| `x-llama-dash-queued` | `true` if the request waited in the concurrency queue |
| `x-llama-dash-queue-ms` | Milliseconds spent queued before backend dispatch |
| `x-llama-dash-reason-ms` | Offset from RELAY to first reasoning token (when present) |
| `x-llama-dash-respond-ms` | Offset from RELAY to first content token (when present) |

```json
"timings_llama_dash": {
  "queued": false,
  "queue_ms": 0,
  "reason_ms": 80,
  "respond_ms": 180,
  "model_loading_ms": 12,
  "prefill_ms": 40,
  "reasoning_ms": 100,
  "response_ms": 60
}
```

SSE progress comments use the same RELAY-relative clock (never wall-clock epoch):

```
: relayed at_ms=0
: reason at_ms=80
: respond at_ms=180
```

`reason_ms` / `respond_ms` / SSE `at_ms` are offsets from RELAY (`at_ms=0`).
Clients anchor RELAY on their local clock and add the offsets for REASON/RESPOND.
Prefill/response/model-loading/reasoning match request-log display phases.
The playground prefers body `timings_llama_dash` over headers when reconstructing
the event tape for `stream: false`.

## When it applies

Local backend + completion endpoint (`/v1/chat/completions`, `/v1/completions`,
`/v1/messages`):

| Client asks | Client sees | Upstream gets |
|-------------|-------------|-----------------|
| `stream: true` | Progress SSE tape (`: queued` / `: relayed` / …) | `stream: true` |
| `stream: false` | Assembled JSON completion | `stream: true` (forced) |

Other routes (`/v1/models`, embeddings, …) are unchanged (long-poll, native body).

Direct upstream routing does not force stream.

## Assembly formats

**OpenAI `chat.completion`** (from `chat.completion.chunk` deltas):

```json
{
  "id": "chatcmpl_…",
  "object": "chat.completion",
  "created": 1700000000,
  "model": "…",
  "choices": [{
    "index": 0,
    "message": {
      "role": "assistant",
      "content": "…",
      "reasoning_content": "…",
      "tool_calls": [{ "id": "…", "type": "function", "function": { "name": "…", "arguments": "…" } }]
    },
    "finish_reason": "stop"
  }],
  "usage": { "prompt_tokens": N, "completion_tokens": M, "total_tokens": N+M },
  "timings": { "prompt_ms": …, "predicted_ms": … }
}
```

**Anthropic `message`** (from `message_start` / `content_block_*` / `message_delta`):

```json
{
  "id": "msg_…",
  "type": "message",
  "role": "assistant",
  "model": "…",
  "content": [{ "type": "text", "text": "…" }],
  "stop_reason": "end_turn",
  "stop_sequence": null,
  "usage": { "input_tokens": N, "output_tokens": M }
}
```

**OpenAI legacy `text_completion`** for `/v1/completions` when detected.

Implementation: `src/server/proxy/assemble-sse-completion.ts`, consumed by
`forwardUpstreamAndLog` when `assembleNonStream` is set.

## Playground / timing

- Stream clients: live tape on the wire (`: queued` / `: relayed` / `: reason` / `: respond`).
- Non-stream clients: reconstruct START → QUEUE? → RELAY → REASON? → RESPOND? → END
  from `timings_llama_dash` in the JSON body (preferred) or the headers above
  after JSON arrives (REASON/RESPOND only when those offsets are present).
  Request **logs** get full phase timings from the upstream SSE scan either way.
