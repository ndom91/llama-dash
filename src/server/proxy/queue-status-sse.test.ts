import { describe, expect, it, vi } from 'vitest'
import {
  createQueuedSseStream,
  formatQueueComment,
  formatRelayedComment,
  parseQueueComment,
  parseRelayedComment,
  sendQueueNotice,
} from './queue-status-sse.ts'

describe('formatQueueComment', () => {
  it('formats a valid SSE comment with queue status', () => {
    const comment = formatQueueComment(
      {
        position: 3,
        queueDepth: 5,
        maxQueue: 20,
        activeSlots: 4,
        maxConcurrency: 4,
        currentModel: 'llama3',
        estimatedEtaMs: 14000,
      },
      'llama3',
      'req_01J5A3K',
    )
    expect(comment).toBe(': queued position=3 eta=14s model=llama3 request_id=req_01J5A3K')
  })

  it('uses ?s when ETA is null', () => {
    const comment = formatQueueComment(
      {
        position: 1,
        queueDepth: 1,
        maxQueue: 20,
        activeSlots: 4,
        maxConcurrency: 4,
        currentModel: 'mistral',
        estimatedEtaMs: null,
      },
      'mistral',
      'req_01ABC',
    )
    expect(comment).toBe(': queued position=1 eta=?s model=mistral request_id=req_01ABC')
  })

  it('starts with colon (SSE comment format)', () => {
    const comment = formatQueueComment(
      {
        position: 1,
        queueDepth: 1,
        maxQueue: 10,
        activeSlots: 2,
        maxConcurrency: 2,
        currentModel: 'qwen',
        estimatedEtaMs: 5000,
      },
      'qwen',
      'req_test',
    )
    expect(comment.startsWith(':')).toBe(true)
  })

  it('rounds ETA to nearest second', () => {
    const comment = formatQueueComment(
      {
        position: 1,
        queueDepth: 1,
        maxQueue: 10,
        activeSlots: 2,
        maxConcurrency: 2,
        currentModel: 'test',
        estimatedEtaMs: 14600,
      },
      'test',
      'req_x',
    )
    expect(comment).toContain('eta=15s')
  })

  it('handles zero ETA', () => {
    const comment = formatQueueComment(
      {
        position: 1,
        queueDepth: 1,
        maxQueue: 10,
        activeSlots: 0,
        maxConcurrency: 2,
        currentModel: 'test',
        estimatedEtaMs: 0,
      },
      'test',
      'req_x',
    )
    expect(comment).toContain('eta=0s')
  })

  it('handles special characters in model name', () => {
    const comment = formatQueueComment(
      {
        position: 1,
        queueDepth: 1,
        maxQueue: 10,
        activeSlots: 2,
        maxConcurrency: 2,
        currentModel: 'Qwen3.6-27B-MTP-UD-Q4_K_XL',
        estimatedEtaMs: 5000,
      },
      'Qwen3.6-27B-MTP-UD-Q4_K_XL',
      'req_x',
    )
    expect(comment).toContain('model=Qwen3.6-27B-MTP-UD-Q4_K_XL')
  })
})

describe('formatRelayedComment', () => {
  it('formats a bare relayed marker', () => {
    expect(formatRelayedComment()).toBe(': relayed')
  })
})

describe('parse queue/relayed comments', () => {
  it('parses queued status comments', () => {
    expect(parseQueueComment(': queued position=3 eta=14s model=llama3 request_id=queue_x')).toEqual({
      position: 3,
      eta: '14s',
      model: 'llama3',
    })
  })

  it('parses bare relayed comments', () => {
    expect(parseRelayedComment(': relayed')).toEqual({ waitMs: null })
  })

  it('parses legacy relayed wait comments', () => {
    expect(parseRelayedComment(': relayed wait_ms=250')).toEqual({ waitMs: 250 })
  })
})

describe('sendQueueNotice', () => {
  it('encodes and enqueues SSE comment to controller', () => {
    const chunks: Uint8Array[] = []
    const controller = {
      enqueue(chunk: Uint8Array) {
        chunks.push(chunk)
      },
      error() {},
    } as unknown as ReadableStreamDefaultController

    sendQueueNotice(
      controller,
      {
        position: 2,
        queueDepth: 3,
        maxQueue: 20,
        activeSlots: 4,
        maxConcurrency: 4,
        currentModel: 'llama3',
        estimatedEtaMs: 10000,
      },
      'llama3',
      'req_01XYZ',
    )

    const decoder = new TextDecoder()
    const text = decoder.decode(chunks[0])
    expect(text).toContain(': queued position=2')
    expect(text).toContain('eta=10s')
    expect(text).toContain('model=llama3')
    expect(text).toContain('request_id=req_01XYZ')
    expect(text.endsWith('\n\n')).toBe(true)
  })

  it('handles controller error gracefully', () => {
    const controller = {
      enqueue() {
        throw new Error('Client disconnected')
      },
      error() {},
    } as unknown as ReadableStreamDefaultController

    expect(() =>
      sendQueueNotice(
        controller,
        {
          position: 1,
          queueDepth: 1,
          maxQueue: 10,
          activeSlots: 2,
          maxConcurrency: 2,
          currentModel: 'test',
          estimatedEtaMs: 0,
        },
        'test',
        'req_err',
      ),
    ).not.toThrow()
  })

  it('encodes binary data correctly', () => {
    const chunks: Uint8Array[] = []
    const controller = {
      enqueue(chunk: Uint8Array) {
        chunks.push(chunk)
      },
      error() {},
    } as unknown as ReadableStreamDefaultController

    sendQueueNotice(
      controller,
      {
        position: 1,
        queueDepth: 1,
        maxQueue: 10,
        activeSlots: 2,
        maxConcurrency: 2,
        currentModel: 'test',
        estimatedEtaMs: 0,
      },
      'test',
      'req_x',
    )

    expect(chunks.length).toBe(1)
    expect(chunks[0]).toBeInstanceOf(Uint8Array)
    expect(chunks[0].byteLength).toBeGreaterThan(0)
  })
})

describe('createQueuedSseStream', () => {
  it('pipes upstream response body through the stream', async () => {
    vi.useFakeTimers()
    const encoder = new TextEncoder()
    const upstreamBody = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"id":"test"}\n\n'))
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      },
    })
    const upstreamResponse = new Response(upstreamBody, {
      headers: { 'content-type': 'text/event-stream' },
    })

    const waitPromise = Promise.resolve(upstreamResponse)
    const stream = createQueuedSseStream(
      {
        getQueuePosition: () => 1,
        getStatus: () => ({
          position: 1,
          queueDepth: 1,
          maxQueue: 10,
          activeSlots: 2,
          maxConcurrency: 2,
          currentModel: 'test',
          estimatedEtaMs: 0,
        }),
        setSseController: vi.fn(),
        cancelQueued: vi.fn(),
      } as any,
      'req_test',
      'llama3',
      waitPromise,
    )

    const reader = stream.getReader()
    const chunks: Uint8Array[] = []
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(value)
    }

    const decoder = new TextDecoder()
    const text = chunks.map((c) => decoder.decode(c)).join('')
    // Immediate keep-alive ping at enqueue; RELAY comes from the scheduler.
    expect(text).toContain(': queued position=1')
    expect(text).not.toContain(': relayed')
    expect(text).toContain('data: {"id":"test"}')
    expect(text).toContain('data: [DONE]')

    vi.useRealTimers()
  })

  it('sends periodic queue keep-alive comments while waiting', async () => {
    vi.useFakeTimers()
    let resolveWait!: (value: Response) => void
    const waitPromise = new Promise<Response>((resolve) => {
      resolveWait = resolve
    })
    const getQueuePosition = vi.fn(() => 2)
    const stream = createQueuedSseStream(
      {
        getQueuePosition,
        getStatus: () => ({
          position: 2,
          queueDepth: 3,
          maxQueue: 10,
          activeSlots: 4,
          maxConcurrency: 4,
          currentModel: 'llama3',
          estimatedEtaMs: 10_000,
        }),
        setSseController: vi.fn(),
        cancelQueued: vi.fn(),
      } as any,
      'queue_ping',
      'llama3',
      waitPromise,
    )

    const reader = stream.getReader()
    const readChunk = async () => {
      const { value } = await reader.read()
      return new TextDecoder().decode(value)
    }

    expect(await readChunk()).toContain(': queued position=2')
    await vi.advanceTimersByTimeAsync(5_000)
    expect(await readChunk()).toContain(': queued position=2')
    await vi.advanceTimersByTimeAsync(5_000)
    expect(await readChunk()).toContain(': queued position=2')

    const encoder = new TextEncoder()
    resolveWait(
      new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(encoder.encode('data: {"ok":true}\n\n'))
            controller.close()
          },
        }),
      ),
    )

    const rest: string[] = []
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      rest.push(new TextDecoder().decode(value))
    }
    expect(rest.join('')).toContain('data: {"ok":true}')
    vi.useRealTimers()
  })

  it('sends error data when wait promise rejects', async () => {
    vi.useFakeTimers()
    const waitPromise = Promise.reject(new Error('Queue timeout after 5000ms'))
    const stream = createQueuedSseStream(
      {
        getQueuePosition: () => 1,
        getStatus: () => ({
          position: 1,
          queueDepth: 1,
          maxQueue: 10,
          activeSlots: 2,
          maxConcurrency: 2,
          currentModel: 'test',
          estimatedEtaMs: 0,
        }),
        setSseController: vi.fn(),
        cancelQueued: vi.fn(),
      } as any,
      'req_test',
      'llama3',
      waitPromise,
    )

    const reader = stream.getReader()
    const chunks: Uint8Array[] = []
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(value)
    }

    const decoder = new TextDecoder()
    const text = chunks.map((c) => decoder.decode(c)).join('')
    expect(text).toContain('queue_timeout')
    expect(text).toContain('Queue timeout after 5000ms')

    vi.useRealTimers()
  })

  it('handles empty upstream response body', async () => {
    vi.useFakeTimers()
    const upstreamResponse = new Response(null, {
      status: 204,
    })

    const waitPromise = Promise.resolve(upstreamResponse)
    const stream = createQueuedSseStream(
      {
        getQueuePosition: () => 1,
        getStatus: () => ({
          position: 1,
          queueDepth: 1,
          maxQueue: 10,
          activeSlots: 2,
          maxConcurrency: 2,
          currentModel: 'test',
          estimatedEtaMs: 0,
        }),
        setSseController: vi.fn(),
        cancelQueued: vi.fn(),
      } as any,
      'req_empty',
      'test',
      waitPromise,
    )

    const reader = stream.getReader()
    const chunks: Uint8Array[] = []
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(value)
    }

    // Immediate queue ping may be present; no upstream data chunks.
    const decoder = new TextDecoder()
    const text = chunks.map((c) => decoder.decode(c)).join('')
    expect(text).not.toContain('data:')

    vi.useRealTimers()
  })

  it('preserves upstream response chunks in order', async () => {
    vi.useFakeTimers()
    const encoder = new TextEncoder()
    const upstreamBody = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"chunk":1}\n\n'))
        controller.enqueue(encoder.encode('data: {"chunk":2}\n\n'))
        controller.enqueue(encoder.encode('data: {"chunk":3}\n\n'))
        controller.close()
      },
    })
    const upstreamResponse = new Response(upstreamBody, {
      headers: { 'content-type': 'text/event-stream' },
    })

    const waitPromise = Promise.resolve(upstreamResponse)
    const stream = createQueuedSseStream(
      {
        getQueuePosition: () => 1,
        getStatus: () => ({
          position: 1,
          queueDepth: 1,
          maxQueue: 10,
          activeSlots: 2,
          maxConcurrency: 2,
          currentModel: 'test',
          estimatedEtaMs: 0,
        }),
        setSseController: vi.fn(),
        cancelQueued: vi.fn(),
      } as any,
      'req_order',
      'test',
      waitPromise,
    )

    const reader = stream.getReader()
    const chunks: Uint8Array[] = []
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(value)
    }

    const decoder = new TextDecoder()
    const text = chunks.map((c) => decoder.decode(c)).join('')
    const idx1 = text.indexOf('{"chunk":1}')
    const idx2 = text.indexOf('{"chunk":2}')
    const idx3 = text.indexOf('{"chunk":3}')
    expect(idx1).toBeLessThan(idx2)
    expect(idx2).toBeLessThan(idx3)

    vi.useRealTimers()
  })
})
