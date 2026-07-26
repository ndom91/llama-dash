import { config } from '../config.ts'
import { forwardUpstreamAndLog } from './forward.ts'
import { updateInflight } from './inflight-requests.ts'
import { formatRelayedComment } from './queue-status-sse.ts'

export type QueueEntryId = string

export type QueueStatus = {
  position: number
  queueDepth: number
  maxQueue: number
  activeSlots: number
  maxConcurrency: number
  currentModel: string | null
  estimatedEtaMs: number | null
}

export type QueueEntry = {
  id: QueueEntryId
  model: string
  enqueueTime: number
  requestData: ProxyRequestData
  resolve: (value: Response) => void
  reject: (reason: Error) => void
  timeoutTimer: ReturnType<typeof setTimeout> | null
  sseController: ReadableStreamDefaultController | null
}

export type ProxyRequestData = {
  /** Prefixed ULID shared with inflight tracking and the finished log row. */
  id: string
  upstream: string
  method: string
  headers: Record<string, string>
  body: unknown
  hasBody: boolean
  startedAt: number
  /**
   * Wall ms when the early-commit SSE response was created (START).
   * Preferred basis for queue_ms = RELAY − START.
   */
  earlyCommitAtMs: number | null
  /** Wall ms when the request entered the scheduler queue (fallback START). */
  enqueueAtMs: number | null
  /** Wall ms when `: relayed` was emitted (RELAY / scanner dispatch clock). */
  relayedAtMs: number | null
  /** Milliseconds spent waiting in the concurrency queue before dispatch (0 if immediate). */
  queueMs: number
  /**
   * Client asked for non-stream; upstream was forced to `stream: true` so we can
   * scan phase timings, then assemble JSON for the client.
   */
  assembleNonStream: boolean
  endpoint: string
  reqModel: string | null
  reqHeadersJson: string
  reqBody: string | null
  keyId: string | null
  keyRow: unknown
  attribution: { clientName: string | null; endUserId: string | null; sessionId: string | null }
  routing: unknown
  credentialInjectionJson: string | null
}

/** Mark RELAY and derive queue_ms = RELAY − START (early-commit, else enqueue). */
export function markRelayed(requestData: ProxyRequestData, relayedAtMs = Date.now()): number {
  requestData.relayedAtMs = relayedAtMs
  const startAt = requestData.earlyCommitAtMs ?? requestData.enqueueAtMs
  requestData.queueMs = startAt != null ? Math.max(0, relayedAtMs - startAt) : 0
  updateInflight(requestData.id, { phase: 'active' })
  return relayedAtMs
}

type SchedulerConfig = {
  maxConcurrency: number
  maxQueueSize: number
  queueTimeoutMs: number
  batchWindowMs: number
  fairnessTimeoutMs: number
  modelGrouping: boolean
}

export type EnqueueResult =
  | { status: 'immediate'; startDispatch: (relayedAtMs?: number) => Promise<Response> }
  | { status: 'queued'; waitPromise: Promise<Response>; entryId: QueueEntryId }
  | { status: 'overflow'; queueDepth: number; maxQueue: number }

export class ModelScheduler {
  private queue: QueueEntry[] = []
  private currentModel: string | null = null
  private activeSlots = 0
  private batchTimer: ReturnType<typeof setTimeout> | null = null
  private config: SchedulerConfig
  private dispatchLatencies: number[] = []

  constructor(cfg?: Partial<SchedulerConfig>) {
    this.config = {
      maxConcurrency: cfg?.maxConcurrency ?? 4,
      maxQueueSize: cfg?.maxQueueSize ?? 20,
      queueTimeoutMs: cfg?.queueTimeoutMs ?? 60_000,
      batchWindowMs: cfg?.batchWindowMs ?? 2_000,
      fairnessTimeoutMs: cfg?.fairnessTimeoutMs ?? 30_000,
      modelGrouping: cfg?.modelGrouping ?? true,
    }
  }

  getCurrentModel(): string | null {
    return this.currentModel
  }

  getStatus(): QueueStatus {
    return {
      position: this.queue.length,
      queueDepth: this.queue.length,
      maxQueue: this.config.maxQueueSize,
      activeSlots: this.activeSlots,
      maxConcurrency: this.config.maxConcurrency,
      currentModel: this.currentModel,
      estimatedEtaMs: this.estimateEta(),
    }
  }

  getQueueDepth(): number {
    return this.queue.length
  }

  getActiveSlots(): number {
    return this.activeSlots
  }

  // Called by handler.ts when a local backend request arrives
  enqueue(entryId: string, model: string, requestData: ProxyRequestData): EnqueueResult {
    if (this.queue.length >= this.config.maxQueueSize && this.activeSlots >= this.config.maxConcurrency) {
      return { status: 'overflow', queueDepth: this.queue.length, maxQueue: this.config.maxQueueSize }
    }

    if (this.activeSlots >= this.config.maxConcurrency) {
      if (this.queue.length >= this.config.maxQueueSize) {
        return { status: 'overflow', queueDepth: this.queue.length, maxQueue: this.config.maxQueueSize }
      }
      return this.enqueueAndWait(entryId, model, requestData)
    }

    this.activeSlots++
    this.currentModel = model
    // Lazily start dispatch so SSE can commit `: relayed` before undiciFetch.
    // queueMs / relayedAtMs are filled when RELAY is marked.
    return {
      status: 'immediate',
      startDispatch: (relayedAtMs = Date.now()) => {
        markRelayed(requestData, relayedAtMs)
        return this.dispatchHoldingSlot(requestData, null)
      },
    }
  }

  private enqueueAndWait(entryId: string, model: string, requestData: ProxyRequestData): EnqueueResult {
    const enqueueTime = Date.now()
    requestData.enqueueAtMs = enqueueTime
    const entry: QueueEntry = {
      id: entryId,
      model,
      enqueueTime,
      requestData,
      resolve: () => {},
      reject: () => {},
      timeoutTimer: null,
      sseController: null,
    }

    this.queue.push(entry)

    const waitPromise = new Promise<Response>((resolve, reject) => {
      entry.resolve = resolve
      entry.reject = reject

      if (this.config.queueTimeoutMs > 0) {
        entry.timeoutTimer = setTimeout(() => {
          const idx = this.queue.findIndex((e) => e.id === entry.id)
          if (idx !== -1) {
            this.queue.splice(idx, 1)
            entry.timeoutTimer = null
            reject(new Error(`Queue timeout after ${this.config.queueTimeoutMs}ms`))
          }
        }, this.config.queueTimeoutMs)
      }
    })

    this.scheduleEvaluation()
    return { status: 'queued', waitPromise, entryId }
  }

  getSseController(entryId: string): ReadableStreamDefaultController | null {
    const entry = this.queue.find((e) => e.id === entryId)
    return entry?.sseController ?? null
  }

  setSseController(entryId: string, controller: ReadableStreamDefaultController | null): void {
    const entry = this.queue.find((e) => e.id === entryId)
    if (entry) {
      entry.sseController = controller
    }
  }

  getQueuePosition(entryId: string): number {
    const idx = this.queue.findIndex((e) => e.id === entryId)
    return idx >= 0 ? idx + 1 : 0
  }

  /**
   * Drop a still-queued entry (e.g. client cancelled the SSE keep-alive stream
   * before a slot was acquired). No-ops if the entry was already dispatched.
   */
  cancelQueued(entryId: string, reason = 'Client cancelled while queued'): boolean {
    const idx = this.queue.findIndex((e) => e.id === entryId)
    if (idx === -1) return false
    const [entry] = this.queue.splice(idx, 1)
    if (entry.timeoutTimer) {
      clearTimeout(entry.timeoutTimer)
      entry.timeoutTimer = null
    }
    entry.sseController = null
    entry.reject(new Error(reason))
    return true
  }

  // Called when a dispatched request completes — wait the batch window
  // so same-model requests can collect before the next selectNext().
  private onDispatchComplete() {
    this.activeSlots--
    if (this.activeSlots < 0) this.activeSlots = 0
    this.scheduleEvaluation()
  }

  // Called when upstream model state changes. Only applied while idle so
  // watcher polls do not fight the scheduler's in-flight model preference.
  onModelChanged(newModel: string | null) {
    if (this.activeSlots > 0) return
    if (this.currentModel === newModel) return
    this.currentModel = newModel
    this.scheduleEvaluation()
  }

  private scheduleEvaluation() {
    if (this.batchTimer) return
    if (this.activeSlots >= this.config.maxConcurrency) return
    if (this.queue.length === 0) return

    const delay = this.shouldDrainImmediately() ? 0 : this.config.batchWindowMs
    this.batchTimer = setTimeout(() => {
      this.batchTimer = null
      this.evaluateQueue()
    }, delay)
  }

  private shouldDrainImmediately(): boolean {
    if (this.config.batchWindowMs <= 0) return true
    if (this.queue.length === 0) return true
    const now = Date.now()
    const oldest = this.queue.reduce((a, b) => (a.enqueueTime < b.enqueueTime ? a : b))
    return now - oldest.enqueueTime > this.config.fairnessTimeoutMs
  }

  private evaluateQueue() {
    // Fill all free slots in one pass (batch window already elapsed).
    while (this.activeSlots < this.config.maxConcurrency && this.queue.length > 0) {
      const candidate = this.selectNext()
      if (!candidate) break

      this.queue = this.queue.filter((e) => e.id !== candidate.id)
      if (candidate.timeoutTimer) {
        clearTimeout(candidate.timeoutTimer)
        candidate.timeoutTimer = null
      }

      this.currentModel = candidate.model
      this.activeSlots++

      // Emit RELAY on the early-committed SSE controller *before* upstream fetch so
      // clients see "queue done + dispatched to backend", not "upstream headers".
      const dispatchPromise = this.dispatchHoldingSlot(candidate.requestData, candidate.sseController)
      dispatchPromise
        .then((response) => candidate.resolve(response))
        .catch((err) => candidate.reject(err instanceof Error ? err : new Error(String(err))))
    }
  }

  // Core scheduling logic
  private selectNext(): QueueEntry | null {
    if (this.queue.length === 0) return null

    const now = Date.now()

    // 1. Fairness: oldest request dispatched regardless of model
    const oldest = this.queue.reduce((a, b) => (a.enqueueTime < b.enqueueTime ? a : b))
    if (now - oldest.enqueueTime > this.config.fairnessTimeoutMs) {
      return oldest
    }

    // 2. Same-model preference (model grouping)
    if (this.config.modelGrouping && this.currentModel) {
      const sameModel = this.queue.filter((e) => e.model === this.currentModel)
      if (sameModel.length > 0) {
        return sameModel.reduce((a, b) => (a.enqueueTime < b.enqueueTime ? a : b))
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
      const group = this.queue.filter((e) => e.model === largestModel)
      return group.reduce((a, b) => (a.enqueueTime < b.enqueueTime ? a : b))
    }

    // 4. FIFO fallback
    return this.queue.reduce((a, b) => (a.enqueueTime < b.enqueueTime ? a : b))
  }

  private async dispatchHoldingSlot(
    requestData: ProxyRequestData,
    sseController: ReadableStreamDefaultController<Uint8Array> | null,
  ): Promise<Response> {
    // RELAY = queue finished + we are sending to the backend (not upstream headers).
    // Immediate path marks RELAY in createImmediateSseStream before startDispatch.
    if (sseController) {
      markRelayed(requestData)
      try {
        const encoder = new TextEncoder()
        // Wire `at_ms` is RELAY-relative (always 0); wall clock stays server-internal.
        sseController.enqueue(encoder.encode(`${formatRelayedComment(0)}\n\n`))
      } catch {
        // Client disconnected — continue dispatch; cancel paths release the slot.
      }
    } else if (requestData.relayedAtMs == null) {
      markRelayed(requestData)
    }
    try {
      const response = await this.dispatch(requestData)
      return this.holdSlotUntilBodyDone(response)
    } catch (err) {
      this.onDispatchComplete()
      throw err
    }
  }

  /**
   * Concurrency-slot lifetime (local backends only; any concurrency N, any backend):
   * hold until the server finishes the whole response body, or the client disconnects
   * (cancel/error). Headers alone must never free the slot — that lets another request
   * hit the backend mid-stream and preempt generation.
   *
   * Uses TransformStream + pipeTo so backpressure and cancel propagate correctly.
   */
  private holdSlotUntilBodyDone(response: Response): Response {
    const headers = new Headers(response.headers)

    if (!response.body) {
      this.onDispatchComplete()
      return new Response(null, {
        status: response.status,
        statusText: response.statusText,
        headers,
      })
    }

    let released = false
    const release = () => {
      if (released) return
      released = true
      this.onDispatchComplete()
    }

    const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>()
    void response.body.pipeTo(writable).then(release, release)

    return new Response(readable, {
      status: response.status,
      statusText: response.statusText,
      headers,
    })
  }

  private async dispatch(requestData: ProxyRequestData): Promise<Response> {
    const start = Date.now()
    try {
      const result = await forwardUpstreamAndLog({
        ...(requestData as Parameters<typeof forwardUpstreamAndLog>[0]),
        queueMs: requestData.queueMs,
        relayedAtMs: requestData.relayedAtMs ?? undefined,
      })
      const latency = Date.now() - start
      this.dispatchLatencies.push(latency)
      if (this.dispatchLatencies.length > 20) this.dispatchLatencies.shift()

      if ('upstreamError' in result) {
        throw new Error(result.upstreamError)
      }
      return result
    } catch (err) {
      const latency = Date.now() - start
      this.dispatchLatencies.push(latency)
      if (this.dispatchLatencies.length > 20) this.dispatchLatencies.shift()
      throw err
    }
  }

  private estimateEta(): number | null {
    if (this.queue.length === 0) return 0
    if (this.activeSlots === 0) return this.config.batchWindowMs

    const avgLatency =
      this.dispatchLatencies.length > 0
        ? this.dispatchLatencies.reduce((a, b) => a + b, 0) / this.dispatchLatencies.length
        : 5000

    const slotsAvailable = Math.max(0, this.config.maxConcurrency - this.activeSlots)
    if (slotsAvailable === 0) {
      return Math.round((this.queue.length * avgLatency) / this.config.maxConcurrency)
    }

    return Math.round((this.queue.length * avgLatency) / slotsAvailable)
  }

  // For testing: override time
  reset(): void {
    this.queue = []
    this.activeSlots = 0
    this.currentModel = null
    this.dispatchLatencies = []
    if (this.batchTimer) {
      clearTimeout(this.batchTimer)
      this.batchTimer = null
    }
  }
}

// Singleton instance used by handler.ts
let _scheduler: ModelScheduler | null = null

export function getModelScheduler(): ModelScheduler {
  if (!_scheduler) {
    _scheduler = new ModelScheduler({
      maxConcurrency: config.localBackendMaxConcurrent,
      maxQueueSize: config.localBackendMaxQueue,
      queueTimeoutMs: config.localBackendQueueTimeoutMs,
      batchWindowMs: config.modelQueueBatchWindowMs,
      fairnessTimeoutMs: config.modelQueueFairnessTimeoutMs,
      modelGrouping: config.localBackendModelGrouping,
    })
  }
  return _scheduler
}

export function resetModelScheduler(): void {
  if (_scheduler) {
    _scheduler.reset()
  }
}

export function setModelScheduler(scheduler: ModelScheduler): void {
  _scheduler = scheduler
}
