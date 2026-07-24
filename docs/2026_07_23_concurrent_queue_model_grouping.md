# Design v2.4: Upstream Concurrency, Queue, Keep-Alive & Model-Aware Scheduling

> Date: 2026-07-23
> Version: 2.4

---

## Architecture

### Core Principle

llama-dash fronts two kinds of backends:

| Backend Type | Example | Concurrency Limit? |
|-------------|---------|-------------------|
| **Local** | llama.cpp router, llama-swap | ✅ Yes — single limit for the entire backend |
| **Direct Upstream** | OpenAI, Anthropic, external cloud | ❌ No — bypasses the queue entirely |

The concurrency limiter only gates requests heading to **local inference backends**. Direct upstreams flow through immediately with zero queuing.

### Request Flow

```
Client ──► llama-dash ──► [Routing] ──► Local backend OR Direct upstream
                              │
                     Local? ──┤
                              ├── Yes → [ModelScheduler] → Queue → Forward
                              └── No  → Forward immediately (unlimited)
```

---

## Feature 1: Per-Backend Concurrency Limit + Queue + Overflow

### Design

A single semaphore gates how many requests can be active on the local backend at once. All models share this pool. When the limit is reached, requests enter a bounded FIFO queue. When the queue is full, new requests get 503 Service Unavailable.

**Slot release is a general rule**, independent of which local backend is selected and of `LOCAL_BACKEND_MAX_CONCURRENT`: the slot is held until the server finishes the whole response body, or the client disconnects (cancel/error). `forwardUpstreamAndLog` returns as soon as response headers arrive so SSE can start flowing — releasing then would let another request hit the backend mid-stream and preempt generation (e.g. concurrency=1, long Qwen-35B stream interrupted by a Qwen-27B call).

**Phase timings are proxy wall-clock** and must sum to `duration_ms`:

```
duration_ms ≈ queue_ms + prefill_ms + decode_ms + stream_close_ms + other
```

- `queue_ms` — concurrency wait before upstream dispatch (0 if immediate)
- `prefill_ms` — dispatch → first generated token (SSE; includes TTFB)
- `decode_ms` — first token → `[DONE]` (SSE), or dispatch → body end (JSON)
- `stream_close_ms` — `[DONE]` → body end (SSE only)
- `other` — auth/routing/setup before dispatch (and any leftover)

llama.cpp `timings.prompt_ms` / `predicted_ms` are stored separately as
`gpu_prefill_ms` / `gpu_decode_ms` for request log/detail only — they are
**not** stacked into the wall-clock timeline bar.

**Queue wait is measured and persisted** as `queue_ms` on the request log (0 when dispatched immediately). Immediate responses also carry `x-llama-dash-queue-ms`. Queued SSE streams emit `: queued …` keep-alives while waiting (every 5s, plus an immediate first ping), then `: relayed` when the slot is acquired / dispatched to the backend, before upstream `data:` events. Request detail Timing/Phases and the playground inspector (START → QUEUE → RELAY → …) surface this phase; QUEUE is logged once from the first keep-alive.

**Direct upstreams completely bypass this system.**

#### Configuration

```env
LOCAL_BACKEND_MAX_CONCURRENT=4        # Max parallel requests to local backend
LOCAL_BACKEND_MAX_QUEUE=20            # Max total queued requests. Beyond this → 503
LOCAL_BACKEND_QUEUE_TIMEOUT_MS=60000  # Max wait time in queue. Beyond this → 408
                                       # Set to -1 to disable (wait indefinitely)
```

**`LOCAL_BACKEND_QUEUE_TIMEOUT_MS=-1`** disables the timeout entirely. Queued requests will wait forever until a slot opens. This is useful for production setups where dropping requests is worse than latency spikes. The default of 60 seconds protects against hung backends.

#### Overflow (503) Response

```json
HTTP/1.1 503 Service Unavailable
Retry-After: 30

{
  "error": {
    "message": "Local backend is at capacity. Queue is full (20/20).",
    "type": "queue_overflow",
    "queue_depth": 20,
    "max_queue": 20
  }
}
```

---

## Feature 2: Queue Keep-Alive (Non-SSE & SSE)

### Unified Design

When a request is queued, the system must keep the client connection alive until the slot is acquired. The approach differs by request type:

#### Non-SSE Requests: HTTP Long-Poll

The HTTP response is **not committed** until the slot is acquired. The connection stays open — client waits normally.

1. Client sends POST request
2. Request enters queue
3. Connection held open (no response headers sent yet)
4. Slot acquired → `forwardUpstreamAndLog()` fires → full response flows
5. Timeout exceeded → `408 Request Timeout` (unless disabled with `-1`)

**Fully OpenAI-compatible:** Standard HTTP clients natively support long-polling. No protocol change.

#### SSE Requests: Comment Lines

The HTTP response **is committed early** with SSE headers. Queue-status comments are sent as keep-alives while waiting; `: relayed` is emitted at backend dispatch.

**Wire format:**
```
: queued position=3 eta=14s model=llama3 request_id=queue_01j5abc
: queued position=2 eta=6s model=llama3 request_id=queue_01j5abc
: relayed
data: {"id":"chatcmpl-xyz","object":"chat.completion.chunk",...}
data: [DONE]
```

- Lines starting with `:` are SSE comments — **invisible per spec**
- Old clients: ignore comments, wait for `data:` lines normally
- New clients: optional parsing for queue position/ETA and relay marker
- Zero breaking changes
- Playground event tape logs QUEUE once (first `: queued`); later pings stay on the wire only

#### Implementation in handler.ts

```typescript
const isSse = ctx.body?.parsedBody?.stream === true

if (isSse && queued) {
  // Commit response early, stream queue comments while waiting
  return handleQueuedSseRequest(ctx, queueEntry)
}

// Non-SSE: hold connection open, no response until slot acquired
return await waitForQueueSlot(ctx, queueEntry)
```

**Reverse-proxy note:** Nginx needs `proxy_read_timeout` ≥ `LOCAL_BACKEND_QUEUE_TIMEOUT_MS` (or effectively unlimited when set to `-1`).

---

## Feature 3: Model-Grouping Algorithm with FIFO Fairness

### The Problem

Without grouping:
```
FIFO: A(llama3) → D(mistral) → B(llama3) → E(mistral) → C(llama3)
Switches: 4 unnecessary model switches
```

With grouping:
```
Batch 1: A,B,C → llama3 (0 switches)
Batch 2: D,E   → mistral (1 switch)
Switches: 1 (saved 3 switches ≈ 15-30s of switch latency)
```

### Timed-Window Model Batching Algorithm

```typescript
// src/server/proxy/model-scheduler.ts

interface QueueEntry {
  id: string
  model: string
  enqueueTime: number
  resolve: (value: Response) => void
  reject: (reason: Error) => void
  controller: ReadableStreamDefaultController | null // for SSE keep-alive pings
}

class ModelScheduler {
  private queue: QueueEntry[] = []
  private currentModel: string | null = null
  private activeSlots = 0
  private batchTimer: ReturnType<typeof setTimeout> | null = null
  private config: {
    maxConcurrency: number
    maxQueueSize: number
    queueTimeoutMs: number     // -1 means no timeout
    batchWindowMs: number
    fairnessTimeoutMs: number
    modelGrouping: boolean
  }

  // Called by handler.ts when a local backend request arrives
  enqueue(entry: QueueEntry): 'immediate' | 'queued' | 'overflow' {
    // Overflow check
    if (this.queue.length >= this.config.maxQueueSize) {
      return 'overflow'
    }

    // Fast path: same model active and slot available
    if (this.config.modelGrouping && entry.model === this.currentModel
        && this.activeSlots < this.config.maxConcurrency) {
      this.activeSlots++
      this.dispatch(entry)
      return 'immediate'
    }

    // Fast path: no grouping or different model but slot available
    if (this.activeSlots < this.config.maxConcurrency) {
      this.activeSlots++
      this.dispatch(entry)
      return 'immediate'
    }

    // Queue it
    this.queue.push(entry)
    this.scheduleEvaluation()
    return 'queued'
  }

  private waitForDispatch(entry: QueueEntry): Promise<Response> {
    return new Promise<Response>((resolve, reject) => {
      entry.resolve = resolve
      entry.reject = reject

      // Timeout guard (skip if disabled with -1)
      if (this.config.queueTimeoutMs > 0) {
        setTimeout(() => {
          const idx = this.queue.findIndex(e => e.id === entry.id)
          if (idx !== -1) {
            this.queue.splice(idx, 1)
            reject(new Error(`Queue timeout after ${this.config.queueTimeoutMs}ms`))
          }
        }, this.config.queueTimeoutMs)
      }

      this.scheduleEvaluation()
    })
  }

  // Called when a dispatched request completes
  onDispatchComplete() {
    this.activeSlots--
    if (this.batchTimer) {
      clearTimeout(this.batchTimer)
      this.batchTimer = null
    }
    this.evaluateQueue()
  }

  // Called when upstream model state changes
  onModelChanged(newModel: string | null) {
    this.currentModel = newModel
    this.scheduleEvaluation()
  }

  private scheduleEvaluation() {
    if (this.batchTimer) return
    if (this.activeSlots >= this.config.maxConcurrency) return

    this.batchTimer = setTimeout(() => {
      this.batchTimer = null
      this.evaluateQueue()
    }, this.config.batchWindowMs)
  }

  private evaluateQueue() {
    if (this.activeSlots >= this.config.maxConcurrency) return
    if (this.queue.length === 0) return

    const candidate = this.selectNext()
    if (!candidate) return

    this.queue = this.queue.filter(e => e.id !== candidate.id)
    this.currentModel = candidate.model
    this.activeSlots++

    this.dispatch(candidate).finally(() => this.onDispatchComplete())
  }

  // Core scheduling logic
  private selectNext(): QueueEntry | null {
    if (this.queue.length === 0) return null

    const now = Date.now()

    // 1. Fairness: oldest request dispatched regardless of model
    const oldest = this.queue.reduce((a, b) => a.enqueueTime < b.enqueueTime ? a : b)
    if (now - oldest.enqueueTime > this.config.fairnessTimeoutMs) {
      return oldest
    }

    // 2. Same-model preference (model grouping)
    if (this.config.modelGrouping && this.currentModel) {
      const sameModel = this.queue.filter(e => e.model === this.currentModel)
      if (sameModel.length > 0) {
        return sameModel.reduce((a, b) => a.enqueueTime < b.enqueueTime ? a : b)
      }
    }

    // 3. Largest model group (minimize switches)
    const modelCounts = new Map<string, number>()
    for (const entry of this.queue) {
      modelCounts.set(entry.model, (modelCounts.get(entry.model) ?? 0) + 1)
    }
    let largestModel: string | null = null
    let largestCount = 0
    for (const [model, count] of modelCounts) {
      if (count > largestCount) {
        largestCount = count
        largestModel = model
      }
    }
    if (largestModel) {
      const group = this.queue.filter(e => e.model === largestModel)
      return group.reduce((a, b) => a.enqueueTime < b.enqueueTime ? a : b)
    }

    // 4. FIFO fallback
    return this.queue.reduce((a, b) => a.enqueueTime < b.enqueueTime ? a : b)
  }

  private async dispatch(entry: QueueEntry): Promise<void> {
    try {
      const response = await forwardUpstreamAndLog(entry.requestData)
      entry.resolve(response)
    } catch (err) {
      entry.reject(err as Error)
    }
  }
}
```

### Algorithm Properties

| Property | Mechanism | Default |
|----------|-----------|---------|
| **Model grouping** | Same-model requests dispatched first | `MODEL_GROUPING=true` |
| **Batch window** | 2s delay to collect more same-model requests | `2000ms` |
| **Fairness guarantee** | Oldest request dispatched after timeout regardless of model | `30000ms` |
| **Largest-group preference** | If no same-model match, pick the model with most queued requests | Always |
| **FIFO fallback** | Ties broken by enqueue time | Always |
| **No-timeout mode** | Set `QUEUE_TIMEOUT_MS=-1` to wait indefinitely | `60000ms` |

### Configuration

```env
LOCAL_BACKEND_MAX_CONCURRENT=4
LOCAL_BACKEND_MAX_QUEUE=20
LOCAL_BACKEND_QUEUE_TIMEOUT_MS=60000     # -1 to disable timeout

# Model-grouping tuning
LOCAL_BACKEND_MODEL_GROUPING=true
MODEL_QUEUE_BATCH_WINDOW_MS=2000
MODEL_QUEUE_FAIRNESS_TIMEOUT_MS=30000
```

### Step-by-Step Walkthrough

```
T=0: Queue: [A:llama3, D:mistral, B:llama3, E:mistral, C:llama3]
     currentModel: null
     activeSlots: 0/4

T=0: evaluateQueue() → no same-model match → largest group: llama3 (3)
     → dispatch A(llama3), currentModel=llama3

T=2s: onDispatchComplete() → evaluateQueue()
     Queue: [D:mistral, B:llama3, E:mistral, C:llama3]
     same-model match: B(llama3), C(llama3)
     → dispatch B(llama3), C(llama3) [batch fills slots]

T=5s: B completes → evaluateQueue()
     Queue: [D:mistral, E:mistral, C:llama3] (C still active)
     same-model: C still running → wait

T=6s: C completes → evaluateQueue()
     Queue: [D:mistral, E:mistral]
     currentModel: llama3, no same-model match
     → largest group: mistral (2)
     → dispatch D(mistral), currentModel=mistral

T=8s: D completes → dispatch E(mistral) [same-model match]

Result: A→B→C (llama3×3) → D→E (mistral×2) = 1 model switch
Pure FIFO: A→D→B→E→C = 4 model switches
```

### Fairness Guarantee

```
Queue: [F:qwen (arrived T=0)]
Then 20 more llama3 requests arrive

With fairness (30s timeout):
T=0:    F:qwen enqueued
T=1-30s: llama3 requests batched and served
T=30s:  fairness timeout hits → F:qwen dispatched IMMEDIATELY

Without fairness: F could wait behind all 20 llama3 requests → starvation
```

Guarantees **no request waits more than 30 seconds** in queue, regardless of model.

---

## Implementation Phases

### Phase 1: Core Queue + Overflow (~2 days)
- `src/server/proxy/model-scheduler.ts` — scheduler class
- `src/server/config.ts` — add env vars (with `-1` timeout support)
- `src/server/proxy/handler.ts` — enqueue/dispatch for local, bypass for direct
- `src/server/proxy/errors.ts` — queue_overflow, queue_timeout

### Phase 2: Queue Keep-Alive (~1 day)
- `src/server/proxy/queue-status-sse.ts` — SSE comment formatting + pings
- `src/server/proxy/handler.ts` — long-poll for non-SSE, early-commit for SSE
- Wire `controller` field from QueueEntry into SSE stream

### Phase 3: Model State Integration (~1 day)
- `src/server/inference/backend.ts` — expose `getCurrentModel()` + events
- Wire `onModelChanged()` into scheduler

---

## Full Env Var Reference

| Variable | Default | Description |
|----------|---------|-------------|
| `LOCAL_BACKEND_MAX_CONCURRENT` | `4` | Max simultaneous requests to **local backend** (all models) |
| `LOCAL_BACKEND_MAX_QUEUE` | `20` | Max total queued requests. Beyond this → **503** |
| `LOCAL_BACKEND_QUEUE_TIMEOUT_MS` | `60000` | Max queue wait time. Beyond this → **408**. Set to **-1** to disable |
| `LOCAL_BACKEND_MODEL_GROUPING` | `true` | Enable model-aware scheduling |
| `MODEL_QUEUE_BATCH_WINDOW_MS` | `2000` | Delay to collect same-model requests before dispatch |
| `MODEL_QUEUE_FAIRNESS_TIMEOUT_MS` | `30000` | Max wait before forcing oldest request (starvation prevention) |

**Direct upstreams: zero configuration — they bypass all of this.**

---

## API Compatibility

| Mechanism | Old Clients | New Clients | Breaking? |
|-----------|-------------|-------------|-----------|
| Non-SSE: hold connection open | Waits normally | Waits normally | ✅ No |
| SSE: `:` comment lines | Ignored (SSE spec) | Parseable | ✅ No |
| 503 overflow | Standard HTTP | Standard HTTP | ✅ No |
| 408 queue timeout | Standard HTTP | Standard HTTP | ✅ No |
| Direct upstream bypass | No change | No change | ✅ No |

**Zero breaking changes to the OpenAI/Anthropic API contract.**

---

## File Summary

| File | Action | Description |
|------|--------|-------------|
| `src/server/proxy/model-scheduler.ts` | **NEW** | Timed-window batching + queue + semaphore |
| `src/server/proxy/queue-status-sse.ts` | **NEW** | Queue keep-alive comments + `: relayed` at dispatch |
| `src/server/config.ts` | Modify | Add `LOCAL_BACKEND_*` and `MODEL_QUEUE_*` env vars |
| `src/server/proxy/handler.ts` | Modify | Enqueue/dispatch for local, bypass for direct |
| `src/server/proxy/errors.ts` | Modify | Queue overflow/timeout error types |
| `src/server/inference/backend.ts` | Modify | Expose `getCurrentModel()` + model-change events |
