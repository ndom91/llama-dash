import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ModelScheduler, type ProxyRequestData } from './model-scheduler.ts'

function makeRequestData(upstream = 'http://test/v1/chat/completions', model = 'llama3'): ProxyRequestData {
  return {
    id: `req_test_${model}`,
    upstream,
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model }),
    hasBody: true,
    startedAt: Date.now(),
    earlyCommitAtMs: null,
    enqueueAtMs: null,
    relayedAtMs: null,
    queueMs: 0,
    assembleNonStream: false,
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

vi.mock('./inflight-requests.ts', () => ({
  updateInflight: vi.fn(),
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

/** Drain a response body so the scheduler can release its concurrency slot. */
async function drainResponse(response: Response) {
  if (response.body) await response.arrayBuffer()
  return response
}

async function awaitAndDrainImmediate(result: ReturnType<ModelScheduler['enqueue']>) {
  if (result.status !== 'immediate') {
    throw new Error(`expected immediate enqueue, got ${result.status}`)
  }
  return drainResponse(await result.startDispatch())
}

describe('ModelScheduler', () => {
  let scheduler: ModelScheduler

  beforeEach(() => {
    vi.useFakeTimers()
    forwardMock.mockClear()
    // Fresh Response per call — a shared body would already be locked after the
    // first holdSlotUntilBodyDone getReader().
    forwardMock.mockImplementation(() => Promise.resolve(Response.json({ id: 'ok' })))
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
    const first = scheduler.enqueue('first', 'any', makeRequestData('http://test/v1', 'any'))
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

    // Drain first response body so the slot frees and fairness can drain
    await awaitAndDrainImmediate(first)
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
      await awaitAndDrainImmediate(r1)
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
      await awaitAndDrainImmediate(r1)
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

    const x1 = scheduler.enqueue('x1', 'llama3', makeRequestData('http://test/v1', 'llama3'))
    const x2 = scheduler.enqueue('x2', 'llama3', makeRequestData('http://test/v1', 'llama3'))
    scheduler.enqueue('x3', 'llama3', makeRequestData('http://test/v1', 'llama3'))
    scheduler.enqueue('x4', 'llama3', makeRequestData('http://test/v1', 'llama3'))
    expect(scheduler.getActiveSlots()).toBe(2)
    expect(scheduler.getQueueDepth()).toBe(2)

    if (x1.status !== 'immediate' || x2.status !== 'immediate') throw new Error('expected immediate')
    const d1 = x1.startDispatch()
    const d2 = x2.startDispatch()
    expect(resolvers.length).toBe(2)

    // Headers resolve; slots stay held until response bodies are drained.
    resolvers[0]!(Response.json({ id: 'ok1' }))
    resolvers[1]!(Response.json({ id: 'ok2' }))
    await Promise.all([drainResponse(await d1), drainResponse(await d2)])

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
    const first = scheduler.enqueue('e1', 'llama3', makeRequestData('http://test/v1', 'llama3'))
    expect(scheduler.getCurrentModel()).toBe('llama3')

    scheduler.enqueue('q1', 'mistral', makeRequestData('http://test/v1', 'mistral'))
    scheduler.enqueue('q2', 'mistral', makeRequestData('http://test/v1', 'mistral'))
    scheduler.enqueue('q3', 'qwen', makeRequestData('http://test/v1', 'qwen'))

    expect(scheduler.getQueueDepth()).toBe(3)

    // Drain first body so the slot frees; then batch window drains largest group
    await awaitAndDrainImmediate(first)
    await vi.advanceTimersByTimeAsync(60)

    expect(scheduler.getCurrentModel()).toBe('mistral')
    expect(scheduler.getActiveSlots()).toBe(1)

    resolvePending()
  })

  // ---- Slot held for full streaming exchange ----

  it('holds the slot until the streaming body finishes (concurrency=1)', async () => {
    scheduler = new ModelScheduler({
      maxConcurrency: 1,
      maxQueueSize: 10,
      queueTimeoutMs: 60_000,
      batchWindowMs: 0,
      fairnessTimeoutMs: 30_000,
      modelGrouping: true,
    })

    let streamController!: ReadableStreamDefaultController<Uint8Array>
    const openStream = new ReadableStream<Uint8Array>({
      start(controller) {
        streamController = controller
        controller.enqueue(new TextEncoder().encode('data: {"thinking":true}\n\n'))
      },
    })

    forwardMock.mockImplementation(async (data: ProxyRequestData) => {
      if (data.reqModel === 'qwen-35b') {
        return new Response(openStream, {
          status: 200,
          headers: { 'content-type': 'text/event-stream' },
        })
      }
      return Response.json({ id: 'qwen-27b-done' })
    })

    const first = scheduler.enqueue(
      'req_35b',
      'qwen-35b',
      makeRequestData('http://test/v1/chat/completions', 'qwen-35b'),
    )
    expect(first.status).toBe('immediate')
    if (first.status !== 'immediate') throw new Error('expected immediate')

    // Headers return while the body is still open — this is when the bug used
    // to free the slot and let a second model preempt llama.cpp mid-stream.
    const firstResponse = await first.startDispatch()
    expect(scheduler.getActiveSlots()).toBe(1)
    expect(forwardMock).toHaveBeenCalledTimes(1)

    const second = scheduler.enqueue(
      'req_27b',
      'qwen-27b',
      makeRequestData('http://test/v1/chat/completions', 'qwen-27b'),
    )
    expect(second.status).toBe('queued')
    expect(scheduler.getQueueDepth()).toBe(1)
    expect(forwardMock).toHaveBeenCalledTimes(1)
    expect(scheduler.getCurrentModel()).toBe('qwen-35b')

    const reader = firstResponse.body!.getReader()
    const firstChunk = await reader.read()
    expect(firstChunk.done).toBe(false)

    // Still streaming — second must not have been forwarded yet
    expect(forwardMock).toHaveBeenCalledTimes(1)

    streamController.close()
    const end = await reader.read()
    expect(end.done).toBe(true)

    await vi.advanceTimersByTimeAsync(0)
    expect(forwardMock).toHaveBeenCalledTimes(2)
    expect(scheduler.getCurrentModel()).toBe('qwen-27b')
    expect(scheduler.getQueueDepth()).toBe(0)

    if (second.status === 'queued') {
      await drainResponse(await second.waitPromise)
    }
  })

  it('records queue wait ms as RELAY − START on requestData', async () => {
    scheduler = new ModelScheduler({
      maxConcurrency: 1,
      maxQueueSize: 10,
      queueTimeoutMs: 60_000,
      batchWindowMs: 0,
      fairnessTimeoutMs: 30_000,
      modelGrouping: true,
    })

    const resolvers: Array<(value: Response) => void> = []
    forwardMock.mockImplementation(async (data: ProxyRequestData) => {
      expect(typeof data.queueMs).toBe('number')
      expect(data.relayedAtMs).toBeTypeOf('number')
      return new Promise<Response>((resolve) => {
        resolvers.push(resolve)
      })
    })

    const firstData = makeRequestData('http://test/v1', 'model-a')
    firstData.earlyCommitAtMs = Date.now()
    const first = scheduler.enqueue('req_a', 'model-a', firstData)
    expect(first.status).toBe('immediate')
    if (first.status !== 'immediate') throw new Error('expected immediate')
    const firstDispatch = first.startDispatch()

    const secondData = makeRequestData('http://test/v1', 'model-b')
    secondData.earlyCommitAtMs = Date.now()
    const second = scheduler.enqueue('req_b', 'model-b', secondData)
    expect(second.status).toBe('queued')

    await vi.advanceTimersByTimeAsync(250)
    resolvers[0]?.(Response.json({ id: 'a' }))
    const firstResponse = await firstDispatch
    expect(firstResponse.headers.get('x-llama-dash-queued')).toBeNull()
    await drainResponse(firstResponse)

    await vi.advanceTimersByTimeAsync(0)
    expect(forwardMock).toHaveBeenCalledTimes(2)
    const queuedCall = forwardMock.mock.calls[1]?.[0] as ProxyRequestData
    expect(queuedCall.queueMs).toBeGreaterThanOrEqual(250)
    expect(queuedCall.relayedAtMs).toBeTypeOf('number')
    expect(queuedCall.earlyCommitAtMs).toBeTypeOf('number')
    expect(queuedCall.queueMs).toBe(queuedCall.relayedAtMs! - queuedCall.earlyCommitAtMs!)

    resolvers[1]?.(Response.json({ id: 'b' }))
    if (second.status === 'queued') {
      const secondResponse = await second.waitPromise
      await drainResponse(secondResponse)
    }
  })

  it('writes : relayed at_ms on the SSE controller when dispatching a queued entry', async () => {
    scheduler = new ModelScheduler({
      maxConcurrency: 1,
      maxQueueSize: 10,
      queueTimeoutMs: 60_000,
      batchWindowMs: 0,
      fairnessTimeoutMs: 30_000,
      modelGrouping: true,
    })

    const resolvers: Array<(value: Response) => void> = []
    forwardMock.mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          resolvers.push(resolve)
        }),
    )

    const first = scheduler.enqueue('req_a', 'model-a', makeRequestData('http://test/v1', 'model-a'))
    if (first.status !== 'immediate') throw new Error('expected immediate')
    const firstDispatch = first.startDispatch()

    const secondData = makeRequestData('http://test/v1', 'model-b')
    secondData.earlyCommitAtMs = 1_000
    const second = scheduler.enqueue('req_b', 'model-b', secondData)
    if (second.status !== 'queued') throw new Error('expected queued')

    const chunks: string[] = []
    const decoder = new TextDecoder()
    scheduler.setSseController(second.entryId, {
      enqueue(chunk: Uint8Array) {
        chunks.push(decoder.decode(chunk))
      },
    } as ReadableStreamDefaultController<Uint8Array>)

    resolvers[0]?.(Response.json({ id: 'a' }))
    await drainResponse(await firstDispatch)
    await vi.advanceTimersByTimeAsync(0)

    expect(chunks.some((c) => /^: relayed at_ms=\d+/.test(c.trim()))).toBe(true)
    expect(secondData.relayedAtMs).toBeTypeOf('number')
    expect(secondData.queueMs).toBe(secondData.relayedAtMs! - 1_000)

    resolvers[1]?.(Response.json({ id: 'b' }))
    await drainResponse(await second.waitPromise)
  })

  it('keeps streaming the first body after a second model is queued', async () => {
    scheduler = new ModelScheduler({
      maxConcurrency: 1,
      maxQueueSize: 10,
      queueTimeoutMs: 60_000,
      batchWindowMs: 0,
      fairnessTimeoutMs: 30_000,
      modelGrouping: true,
    })

    let streamController!: ReadableStreamDefaultController<Uint8Array>
    const openStream = new ReadableStream<Uint8Array>({
      start(controller) {
        streamController = controller
        controller.enqueue(new TextEncoder().encode('data: {"reasoning":1}\n\n'))
      },
    })

    forwardMock.mockImplementation(async (data: ProxyRequestData) => {
      if (data.reqModel === 'model-a') {
        return new Response(openStream, {
          status: 200,
          headers: { 'content-type': 'text/event-stream' },
        })
      }
      return Response.json({ id: 'model-b-done' })
    })

    const first = scheduler.enqueue('req_a', 'model-a', makeRequestData('http://test/v1/chat/completions', 'model-a'))
    expect(first.status).toBe('immediate')
    if (first.status !== 'immediate') throw new Error('expected immediate')
    const firstResponse = await first.startDispatch()
    const reader = firstResponse.body!.getReader()
    expect((await reader.read()).done).toBe(false)

    const second = scheduler.enqueue('req_b', 'model-b', makeRequestData('http://test/v1/chat/completions', 'model-b'))
    expect(second.status).toBe('queued')
    expect(forwardMock).toHaveBeenCalledTimes(1)

    // First generation continues after the second request is only queued.
    for (let i = 0; i < 5; i++) {
      streamController.enqueue(new TextEncoder().encode(`data: {"content":${i}}\n\n`))
      const chunk = await reader.read()
      expect(chunk.done).toBe(false)
      expect(forwardMock).toHaveBeenCalledTimes(1)
      expect(scheduler.getActiveSlots()).toBe(1)
      expect(scheduler.getQueueDepth()).toBe(1)
    }

    streamController.close()
    expect((await reader.read()).done).toBe(true)
    await vi.advanceTimersByTimeAsync(0)
    expect(forwardMock).toHaveBeenCalledTimes(2)

    if (second.status === 'queued') {
      await drainResponse(await second.waitPromise)
    }
  })

  it('does not free the slot when headers arrive with an unread open body', async () => {
    scheduler = new ModelScheduler({
      maxConcurrency: 1,
      maxQueueSize: 5,
      queueTimeoutMs: 60_000,
      batchWindowMs: 0,
      fairnessTimeoutMs: 30_000,
      modelGrouping: true,
    })

    let streamController!: ReadableStreamDefaultController<Uint8Array>
    forwardMock.mockImplementationOnce(
      async () =>
        new Response(
          new ReadableStream<Uint8Array>({
            start(controller) {
              streamController = controller
            },
          }),
          { status: 200, headers: { 'content-type': 'text/event-stream' } },
        ),
    )
    forwardMock.mockImplementationOnce(async () => Response.json({ id: 'second' }))

    const first = scheduler.enqueue('req_a', 'model-a', makeRequestData('http://test/v1', 'model-a'))
    if (first.status !== 'immediate') throw new Error('expected immediate')
    const firstResponse = await first.startDispatch()

    const second = scheduler.enqueue('req_b', 'model-b', makeRequestData('http://test/v1', 'model-b'))
    expect(second.status).toBe('queued')
    expect(forwardMock).toHaveBeenCalledTimes(1)
    expect(scheduler.getActiveSlots()).toBe(1)

    // Cancel unread body so the slot releases (afterEach also resets)
    streamController.close()
    await firstResponse.body?.cancel()
    await vi.advanceTimersByTimeAsync(0)
  })

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

  it('cancelQueued rejects waitPromise and removes the entry', async () => {
    scheduler = new ModelScheduler({
      maxConcurrency: 1,
      maxQueueSize: 10,
      queueTimeoutMs: 60_000,
      batchWindowMs: 0,
      fairnessTimeoutMs: 30_000,
      modelGrouping: true,
    })

    forwardMock.mockImplementation(() => new Promise<Response>(() => {}))
    scheduler.enqueue('req_a', 'model-a', makeRequestData('http://test/v1', 'model-a'))
    const second = scheduler.enqueue('req_b', 'model-b', makeRequestData('http://test/v1', 'model-b'))
    expect(second.status).toBe('queued')
    if (second.status !== 'queued') throw new Error('expected queued')

    const waitRejection = second.waitPromise.then(
      () => 'resolved',
      (err: Error) => err.message,
    )
    expect(scheduler.cancelQueued(second.entryId)).toBe(true)
    expect(scheduler.getQueueDepth()).toBe(0)
    expect(await waitRejection).toContain('cancelled')
  })
})

describe('markRelayed', () => {
  it('sets queue_ms as RELAY − START from earlyCommitAtMs', async () => {
    const { markRelayed } = await import('./model-scheduler.ts')
    const data = makeRequestData()
    data.earlyCommitAtMs = 1_000
    expect(markRelayed(data, 1_250)).toBe(1_250)
    expect(data.relayedAtMs).toBe(1_250)
    expect(data.queueMs).toBe(250)
  })

  it('falls back to enqueueAtMs when earlyCommitAtMs is unset', async () => {
    const { markRelayed } = await import('./model-scheduler.ts')
    const data = makeRequestData()
    data.enqueueAtMs = 500
    markRelayed(data, 800)
    expect(data.queueMs).toBe(300)
  })
})
