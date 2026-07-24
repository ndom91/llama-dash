import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ModelScheduler, type ProxyRequestData } from './model-scheduler.ts'

function makeRequestData(upstream = 'http://test/v1/chat/completions', model = 'llama3'): ProxyRequestData {
  return {
    upstream,
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model }),
    hasBody: true,
    startedAt: Date.now(),
    endpoint: '/v1/chat/completions',
    reqModel: model,
    reqHeadersJson: '{}',
    reqBody: null,
    keyId: null,
    keyRow: null,
    attribution: { clientName: null, endUserId: null, sessionId: null },
    routing: {},
    credentialInjectionJson: null,
  }
}

const forwardMock = vi.hoisted(() => vi.fn())
let pendingResolve: ((value: Response) => void) | null = vi.hoisted(() => null)
let dispatchCallCount = vi.hoisted(() => 0)

vi.mock('./forward.ts', () => ({
  forwardUpstreamAndLog: forwardMock,
}))

function resolvePending() {
  pendingResolve?.(Response.json({ id: 'done' }))
  pendingResolve = null
}

function firstResolvesThenPending() {
  dispatchCallCount = 0
  pendingResolve = null
  forwardMock.mockImplementation(() => {
    dispatchCallCount++
    if (dispatchCallCount === 1) {
      return Promise.resolve(Response.json({ id: 'ok' }))
    }
    return new Promise<Response>((resolve) => {
      pendingResolve = resolve
    })
  })
}

describe('ModelScheduler', () => {
  let scheduler: ModelScheduler

  beforeEach(() => {
    vi.useFakeTimers()
    forwardMock.mockClear()
    forwardMock.mockResolvedValue(Response.json({ id: 'ok' }))
    pendingResolve = null
    dispatchCallCount = 0
    scheduler = new ModelScheduler({
      maxConcurrency: 2,
      maxQueueSize: 4,
      queueTimeoutMs: 5000,
      batchWindowMs: 100,
      fairnessTimeoutMs: 3000,
      modelGrouping: true,
    })
  })

  afterEach(() => {
    scheduler.reset()
    vi.useRealTimers()
  })

  // ---- Basic enqueue ----

  it('dispatches immediately when slots are available', () => {
    const result = scheduler.enqueue('e1', 'llama3', makeRequestData('http://test/v1', 'llama3'))
    expect(result.status).toBe('immediate')
    expect(scheduler.getActiveSlots()).toBe(1)
    expect(scheduler.getQueueDepth()).toBe(0)
  })

  it('dispatches up to maxConcurrency immediately', () => {
    const r1 = scheduler.enqueue('e1', 'llama3', makeRequestData('http://test/v1', 'llama3'))
    const r2 = scheduler.enqueue('e2', 'llama3', makeRequestData('http://test/v1', 'llama3'))
    expect(r1.status).toBe('immediate')
    expect(r2.status).toBe('immediate')
    expect(scheduler.getActiveSlots()).toBe(2)
  })

  it('queues when all slots are full', () => {
    scheduler.enqueue('e1', 'llama3', makeRequestData('http://test/v1', 'llama3'))
    scheduler.enqueue('e2', 'llama3', makeRequestData('http://test/v1', 'llama3'))
    const r3 = scheduler.enqueue('e3', 'llama3', makeRequestData('http://test/v1', 'llama3'))
    expect(r3.status).toBe('queued')
    expect(scheduler.getQueueDepth()).toBe(1)
  })

  it('returns overflow when queue is full', () => {
    scheduler.enqueue('e1', 'llama3', makeRequestData('http://test/v1', 'llama3'))
    scheduler.enqueue('e2', 'llama3', makeRequestData('http://test/v1', 'llama3'))
    scheduler.enqueue('e3', 'llama3', makeRequestData('http://test/v1', 'llama3'))
    scheduler.enqueue('e4', 'llama3', makeRequestData('http://test/v1', 'llama3'))
    scheduler.enqueue('e5', 'llama3', makeRequestData('http://test/v1', 'llama3'))
    scheduler.enqueue('e6', 'llama3', makeRequestData('http://test/v1', 'llama3'))
    const r = scheduler.enqueue('e7', 'llama3', makeRequestData('http://test/v1', 'llama3'))
    expect(r.status).toBe('overflow')
    if (r.status === 'overflow') {
      expect(r.queueDepth).toBe(4)
      expect(r.maxQueue).toBe(4)
    }
  })

  // ---- Model grouping ----

  it('prefers same-model requests when grouping is enabled', () => {
    scheduler.enqueue('e1', 'llama3', makeRequestData('http://test/v1', 'llama3'))
    scheduler.enqueue('e2', 'llama3', makeRequestData('http://test/v1', 'llama3'))
    scheduler.enqueue('e3', 'mistral', makeRequestData('http://test/v1', 'mistral'))
    scheduler.enqueue('e4', 'llama3', makeRequestData('http://test/v1', 'llama3'))
    scheduler.enqueue('e5', 'mistral', makeRequestData('http://test/v1', 'mistral'))

    expect(scheduler.getActiveSlots()).toBe(2)
    expect(scheduler.getQueueDepth()).toBe(3)
    expect(scheduler.getCurrentModel()).toBe('llama3')
  })

  it('picks largest model group when no same-model match', () => {
    scheduler.enqueue('e1', 'llama3', makeRequestData('http://test/v1', 'llama3'))
    scheduler.enqueue('e2', 'llama3', makeRequestData('http://test/v1', 'llama3'))
    scheduler.enqueue('e3', 'mistral', makeRequestData('http://test/v1', 'mistral'))
    scheduler.enqueue('e4', 'mistral', makeRequestData('http://test/v1', 'mistral'))
    scheduler.enqueue('e5', 'mistral', makeRequestData('http://test/v1', 'mistral'))

    expect(scheduler.getActiveSlots()).toBe(2)
    expect(scheduler.getQueueDepth()).toBe(3)
  })

  it('falls back to FIFO when grouping is disabled', () => {
    scheduler = new ModelScheduler({
      maxConcurrency: 2,
      maxQueueSize: 10,
      queueTimeoutMs: 5000,
      batchWindowMs: 100,
      fairnessTimeoutMs: 3000,
      modelGrouping: false,
    })
    scheduler.enqueue('e1', 'llama3', makeRequestData('http://test/v1', 'llama3'))
    scheduler.enqueue('e2', 'mistral', makeRequestData('http://test/v1', 'mistral'))
    scheduler.enqueue('e3', 'llama3', makeRequestData('http://test/v1', 'llama3'))
    scheduler.enqueue('e4', 'llama3', makeRequestData('http://test/v1', 'llama3'))

    expect(scheduler.getActiveSlots()).toBe(2)
    expect(scheduler.getQueueDepth()).toBe(2)
  })

  // ---- Fairness ----

  it('dispatches oldest request after fairness timeout regardless of model', async () => {
    scheduler = new ModelScheduler({
      maxConcurrency: 1,
      maxQueueSize: 10,
      queueTimeoutMs: 10000,
      batchWindowMs: 50,
      fairnessTimeoutMs: 2000,
      modelGrouping: true,
    })

    firstResolvesThenPending()
    // Fill the slot with a dispatch that resolves immediately
    scheduler.enqueue('first', 'any', makeRequestData('http://test/v1', 'any'))
    expect(scheduler.getActiveSlots()).toBe(1)

    // Enqueue qwen request (will be oldest in queue)
    scheduler.enqueue('f1', 'qwen', makeRequestData('http://test/v1', 'qwen'))
    expect(scheduler.getQueueDepth()).toBe(1)

    // Advance past fairness timeout so qwen becomes "old"
    vi.advanceTimersByTime(2001)

    // Now enqueue 3 llama3 requests (newer than fairness timeout)
    scheduler.enqueue('l1', 'llama3', makeRequestData('http://test/v1', 'llama3'))
    scheduler.enqueue('l2', 'llama3', makeRequestData('http://test/v1', 'llama3'))
    scheduler.enqueue('l3', 'llama3', makeRequestData('http://test/v1', 'llama3'))

    expect(scheduler.getQueueDepth()).toBe(4)

    // First dispatch resolves -> onDispatchComplete -> fairness drains immediately (delay 0)
    await vi.advanceTimersByTimeAsync(10)

    // f1:qwen should be picked because it's older than fairness timeout
    expect(scheduler.getCurrentModel()).toBe('qwen')
    expect(scheduler.getQueueDepth()).toBe(3)

    resolvePending()
  })

  // ---- Queue timeout ----

  it('rejects queued request after timeout', async () => {
    scheduler = new ModelScheduler({
      maxConcurrency: 1,
      maxQueueSize: 10,
      queueTimeoutMs: 1000,
      batchWindowMs: 100,
      fairnessTimeoutMs: 30000,
      modelGrouping: true,
    })

    firstResolvesThenPending()
    scheduler.enqueue('e1', 'llama3', makeRequestData('http://test/v1', 'llama3'))
    const queued = scheduler.enqueue('e2', 'llama3', makeRequestData('http://test/v1', 'llama3'))

    expect(queued.status).toBe('queued')

    let err: Error | null = null
    if (queued.status === 'queued') {
      queued.waitPromise.catch((e: Error) => {
        err = e
      })
    }

    vi.advanceTimersByTime(1100)
    await vi.advanceTimersByTimeAsync(10)

    expect(err).not.toBeNull()
    expect(err!.message).toContain('Queue timeout')
  })

  it('does not timeout when timeout is disabled (-1)', async () => {
    scheduler = new ModelScheduler({
      maxConcurrency: 1,
      maxQueueSize: 10,
      queueTimeoutMs: -1,
      batchWindowMs: 100,
      fairnessTimeoutMs: 30000,
      modelGrouping: true,
    })

    firstResolvesThenPending()
    scheduler.enqueue('e1', 'llama3', makeRequestData('http://test/v1', 'llama3'))
    const queued = scheduler.enqueue('e2', 'llama3', makeRequestData('http://test/v1', 'llama3'))

    expect(queued.status).toBe('queued')

    let err: Error | null = null
    if (queued.status === 'queued') {
      queued.waitPromise.catch((e: Error) => {
        err = e
      })
    }

    vi.advanceTimersByTime(60000)
    await vi.advanceTimersByTimeAsync(10)

    expect(err).toBeNull()
  })

  // ---- Queue status ----

  it('reports correct queue position', () => {
    scheduler.enqueue('e1', 'llama3', makeRequestData('http://test/v1', 'llama3'))
    scheduler.enqueue('e2', 'llama3', makeRequestData('http://test/v1', 'llama3'))
    const q1 = scheduler.enqueue('e3', 'llama3', makeRequestData('http://test/v1', 'llama3'))
    const q2 = scheduler.enqueue('e4', 'llama3', makeRequestData('http://test/v1', 'llama3'))

    expect(q1.status).toBe('queued')
    if (q1.status === 'queued') {
      expect(scheduler.getQueuePosition(q1.entryId)).toBe(1)
    }
    expect(q2.status).toBe('queued')
    if (q2.status === 'queued') {
      expect(scheduler.getQueuePosition(q2.entryId)).toBe(2)
    }
  })

  it('returns status object', () => {
    scheduler.enqueue('e1', 'llama3', makeRequestData('http://test/v1', 'llama3'))
    scheduler.enqueue('e2', 'llama3', makeRequestData('http://test/v1', 'llama3'))
    scheduler.enqueue('e3', 'llama3', makeRequestData('http://test/v1', 'llama3'))

    const status = scheduler.getStatus()
    expect(status.activeSlots).toBe(2)
    expect(status.maxConcurrency).toBe(2)
    expect(status.queueDepth).toBe(1)
    expect(status.maxQueue).toBe(4)
    expect(status.currentModel).toBe('llama3')
  })

  // ---- Model change notification ----

  it('re-evaluates queue on model change when idle', () => {
    expect(scheduler.getActiveSlots()).toBe(0)
    scheduler.onModelChanged('mistral')
    expect(scheduler.getCurrentModel()).toBe('mistral')
  })

  it('ignores model change while slots are active', () => {
    scheduler.enqueue('e1', 'llama3', makeRequestData('http://test/v1', 'llama3'))
    expect(scheduler.getCurrentModel()).toBe('llama3')
    expect(scheduler.getActiveSlots()).toBe(1)

    scheduler.onModelChanged('mistral')
    expect(scheduler.getCurrentModel()).toBe('llama3')
  })

  // ---- Batch window ----

  it('waits batch window before draining queue after a slot frees', async () => {
    scheduler = new ModelScheduler({
      maxConcurrency: 1,
      maxQueueSize: 10,
      queueTimeoutMs: 10000,
      batchWindowMs: 100,
      fairnessTimeoutMs: 30000,
      modelGrouping: true,
    })

    firstResolvesThenPending()
    const r1 = scheduler.enqueue('e1', 'llama3', makeRequestData('http://test/v1', 'llama3'))
    const queued = scheduler.enqueue('e2', 'mistral', makeRequestData('http://test/v1', 'mistral'))
    expect(queued.status).toBe('queued')
    expect(scheduler.getQueueDepth()).toBe(1)

    if (r1.status === 'immediate') {
      await r1.dispatchPromise
    }

    // Slot freed, but batch window has not elapsed yet
    expect(scheduler.getQueueDepth()).toBe(1)
    expect(scheduler.getActiveSlots()).toBe(0)

    await vi.advanceTimersByTimeAsync(50)
    expect(scheduler.getQueueDepth()).toBe(1)

    await vi.advanceTimersByTimeAsync(50)
    expect(scheduler.getQueueDepth()).toBe(0)
    expect(scheduler.getActiveSlots()).toBe(1)
    expect(scheduler.getCurrentModel()).toBe('mistral')

    resolvePending()
  })

  // ---- Reset ----

  it('clears all state on reset', () => {
    scheduler.enqueue('e1', 'llama3', makeRequestData('http://test/v1', 'llama3'))
    scheduler.enqueue('e2', 'llama3', makeRequestData('http://test/v1', 'llama3'))
    scheduler.enqueue('e3', 'llama3', makeRequestData('http://test/v1', 'llama3'))

    scheduler.reset()

    expect(scheduler.getActiveSlots()).toBe(0)
    expect(scheduler.getQueueDepth()).toBe(0)
    expect(scheduler.getCurrentModel()).toBeNull()
  })

  // ---- ETA estimation ----

  it('returns 0 ETA when queue is empty and slots available', () => {
    const status = scheduler.getStatus()
    expect(status.estimatedEtaMs).toBe(0)
  })

  // ---- Dispatch completion triggers queue evaluation ----

  it('resolves waitPromise when queued request is dispatched', async () => {
    scheduler = new ModelScheduler({
      maxConcurrency: 1,
      maxQueueSize: 10,
      queueTimeoutMs: 10000,
      batchWindowMs: 50,
      fairnessTimeoutMs: 30000,
      modelGrouping: true,
    })

    firstResolvesThenPending()

    const r1 = scheduler.enqueue('e1', 'llama3', makeRequestData('http://test/v1', 'llama3'))
    expect(r1.status).toBe('immediate')

    const queued = scheduler.enqueue('e2', 'mistral', makeRequestData('http://test/v1', 'mistral'))
    expect(queued.status).toBe('queued')
    expect(scheduler.getQueueDepth()).toBe(1)
    expect(scheduler.getActiveSlots()).toBe(1)

    if (r1.status === 'immediate') {
      await r1.dispatchPromise
    }

    // Advance past batch window so evaluateQueue runs and resolves waitPromise
    const waitPromise = queued.status === 'queued' ? queued.waitPromise : null
    expect(waitPromise).not.toBeNull()

    await vi.advanceTimersByTimeAsync(50)
    expect(scheduler.getQueueDepth()).toBe(0)
    expect(scheduler.getActiveSlots()).toBe(1)

    resolvePending()
    const response = await waitPromise!
    expect(response.ok).toBe(true)
    const body = await response.json()
    expect(body).toEqual({ id: 'done' })
  })

  it('fills multiple free slots after batch window', async () => {
    scheduler = new ModelScheduler({
      maxConcurrency: 2,
      maxQueueSize: 10,
      queueTimeoutMs: 10000,
      batchWindowMs: 50,
      fairnessTimeoutMs: 30000,
      modelGrouping: true,
    })

    // Hold both slots with never-resolving forwards, then replace mock so
    // completions drain the queue into both slots in one evaluateQueue pass.
    const resolvers: Array<(value: Response) => void> = []
    forwardMock.mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          resolvers.push(resolve)
        }),
    )

    scheduler.enqueue('x1', 'llama3', makeRequestData('http://test/v1', 'llama3'))
    scheduler.enqueue('x2', 'llama3', makeRequestData('http://test/v1', 'llama3'))
    scheduler.enqueue('x3', 'llama3', makeRequestData('http://test/v1', 'llama3'))
    scheduler.enqueue('x4', 'llama3', makeRequestData('http://test/v1', 'llama3'))
    expect(scheduler.getActiveSlots()).toBe(2)
    expect(scheduler.getQueueDepth()).toBe(2)
    expect(resolvers.length).toBe(2)

    // Complete both in-flight requests
    resolvers[0](Response.json({ id: 'ok1' }))
    resolvers[1](Response.json({ id: 'ok2' }))
    await Promise.resolve()
    await Promise.resolve()

    expect(scheduler.getActiveSlots()).toBe(0)
    expect(scheduler.getQueueDepth()).toBe(2)

    await vi.advanceTimersByTimeAsync(50)
    expect(scheduler.getQueueDepth()).toBe(0)
    expect(scheduler.getActiveSlots()).toBe(2)
  })

  // ---- Multiple models queue ordering ----

  it('groups by largest model when no current model match', async () => {
    scheduler = new ModelScheduler({
      maxConcurrency: 1,
      maxQueueSize: 10,
      queueTimeoutMs: 10000,
      batchWindowMs: 50,
      fairnessTimeoutMs: 30000,
      modelGrouping: true,
    })

    firstResolvesThenPending()
    scheduler.enqueue('e1', 'llama3', makeRequestData('http://test/v1', 'llama3'))
    expect(scheduler.getCurrentModel()).toBe('llama3')

    scheduler.enqueue('q1', 'mistral', makeRequestData('http://test/v1', 'mistral'))
    scheduler.enqueue('q2', 'mistral', makeRequestData('http://test/v1', 'mistral'))
    scheduler.enqueue('q3', 'qwen', makeRequestData('http://test/v1', 'qwen'))

    expect(scheduler.getQueueDepth()).toBe(3)

    // Immediate dispatch completes, then batch window drains largest group
    await vi.advanceTimersByTimeAsync(60)

    expect(scheduler.getCurrentModel()).toBe('mistral')
    expect(scheduler.getActiveSlots()).toBe(1)

    resolvePending()
  })

  // ---- SSE controller tracking ----

  it('tracks SSE controller for queued entries', () => {
    scheduler.enqueue('e1', 'llama3', makeRequestData('http://test/v1', 'llama3'))
    scheduler.enqueue('e2', 'llama3', makeRequestData('http://test/v1', 'llama3'))
    const queued = scheduler.enqueue('e3', 'llama3', makeRequestData('http://test/v1', 'llama3'))

    expect(queued.status).toBe('queued')
    if (queued.status === 'queued') {
      const mockController = {} as ReadableStreamDefaultController
      scheduler.setSseController(queued.entryId, mockController)
      expect(scheduler.getSseController(queued.entryId)).toBe(mockController)
      scheduler.setSseController(queued.entryId, null)
      expect(scheduler.getSseController(queued.entryId)).toBeNull()
    }
  })
})
