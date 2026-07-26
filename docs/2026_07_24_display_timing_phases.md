# Request display timing model

Display phases (always show every label; `0` or missing → "—"):

```
queue + model loading + prefill + reasoning + response + other = total
```

| Phase | Source |
| --- | --- |
| queue | Local-backend concurrency wait (`queue_ms`) |
| model loading | Wall time from **RELAY** (queue done + dispatched to backend) → **REASON** (or **RESPOND** if no reasoning), minus GPU prefill. Unavailable when neither REASON nor RESPOND exists. |
| prefill | llama.cpp `timings.prompt_ms` |
| reasoning | Wall **REASON** → **RESPOND**; unavailable unless both exist |
| response | llama.cpp `timings.predicted_ms` minus reasoning (or full predicted when no reasoning) |
| other | Remainder so the sum equals `duration_ms` / playground total |
| total | End-to-end request duration |

## Playground / SSE event tape

| Tag | When |
| --- | --- |
| START | Server received the client HTTP request (response headers committed / accepted) |
| QUEUE | Request actually entered the concurrency queue — first `: queued …` only on the event tape; wire keep-alives continue every 5s while waiting |
| RELAY | Dispatched to the inference backend — SSE comment is bare `: relayed` |
| REASON | First reasoning delta (skipped when the model answers without reasoning) |
| RESPOND | First visible answer content delta (skipped for non-stream; END covers response completion) |
| END | Stream / exchange finished |
| ERROR | Failure |

Removed legacy markers: MDL, PFL, EOR, RES (and the old REQ/QUE/REL/RSN/RSP/ERR names).

**RELAY** means: the concurrency queue has released this request and llama-dash has sent the HTTP request to the inference backend. It must **not** wait for upstream response headers or the first SSE token (those are too late — model load already happened).

Surfaces: request detail Timing/Phases rails, request timing bar, playground timing tab / bars.
Raw GPU counters remain in `gpu_prefill_ms` / `gpu_decode_ms`; newer rows also persist `model_loading_ms`, `reasoning_ms`, `response_ms`, and store display prefill in `prefill_ms`.
