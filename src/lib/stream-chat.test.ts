import { describe, expect, it, vi } from 'vitest'
import { streamChatCompletion, type SamplingParams } from './stream-chat.ts'

const sampling: SamplingParams = {
  temperature: 0.7,
  topP: 1,
  topK: 40,
  maxTokens: 16,
  frequencyPenalty: 0,
  presencePenalty: 0,
  stopSequences: [],
  seed: null,
  n: 1,
  stream: true,
  responseFormat: 'text',
  logprobs: false,
}

describe('streamChatCompletion queue events', () => {
  it('emits started then relayed for immediate responses', async () => {
    const events: Array<string> = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        const body = new ReadableStream<Uint8Array>({
          start(controller) {
            const encoder = new TextEncoder()
            controller.enqueue(encoder.encode(': relayed\n\n'))
            controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"hi"}}]}\n\n'))
            controller.enqueue(encoder.encode('data: [DONE]\n\n'))
            controller.close()
          },
        })
        return new Response(body, {
          status: 200,
          headers: {
            'content-type': 'text/event-stream',
            'x-llama-dash-queue-ms': '0',
          },
        })
      }),
    )

    const chunks = []
    for await (const chunk of streamChatCompletion({
      messages: [{ role: 'user', content: 'hi' }],
      model: 'llama3',
      sampling,
      onEvent: (ev) => events.push(ev.kind),
    })) {
      chunks.push(chunk)
    }

    expect(events[0]).toBe('request-sent')
    expect(events).toContain('started')
    expect(events).toContain('relayed')
    expect(events).not.toContain('first-byte')
    expect(events).not.toContain('prefill-done')
    expect(events.indexOf('request-sent')).toBeLessThan(events.indexOf('started'))
    expect(events.indexOf('started')).toBeLessThan(events.indexOf('relayed'))
    expect(events.indexOf('relayed')).toBeLessThan(events.indexOf('content-start'))
    expect(events).not.toContain('reasoning-start')
    expect(chunks.some((c) => c.content === 'hi')).toBe(true)
    vi.unstubAllGlobals()
  })

  it('emits queued once then relayed before upstream data', async () => {
    const events: Array<{ kind: string; position?: number }> = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        const body = new ReadableStream<Uint8Array>({
          start(controller) {
            const encoder = new TextEncoder()
            controller.enqueue(encoder.encode(': queued position=2 eta=5s model=llama3 request_id=queue_x\n\n'))
            // Duplicate queue comments must not re-emit.
            controller.enqueue(encoder.encode(': queued position=1 eta=2s model=llama3 request_id=queue_x\n\n'))
            controller.enqueue(encoder.encode(': relayed\n\n'))
            controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"ok"}}]}\n\n'))
            controller.enqueue(encoder.encode('data: [DONE]\n\n'))
            controller.close()
          },
        })
        return new Response(body, {
          status: 200,
          headers: {
            'content-type': 'text/event-stream',
            'x-llama-dash-queued': 'true',
          },
        })
      }),
    )

    for await (const _chunk of streamChatCompletion({
      messages: [{ role: 'user', content: 'hi' }],
      model: 'llama3',
      sampling,
      onEvent: (ev) => {
        if (ev.kind === 'queued') events.push({ kind: ev.kind, position: ev.position })
        else events.push({ kind: ev.kind })
      },
    })) {
      // drain
    }

    expect(events[0]?.kind).toBe('request-sent')
    expect(events.filter((e) => e.kind === 'queued')).toHaveLength(1)
    expect(events.find((e) => e.kind === 'queued')?.position).toBe(2)
    expect(events.findIndex((e) => e.kind === 'queued')).toBeLessThan(events.findIndex((e) => e.kind === 'relayed'))
    expect(events.findIndex((e) => e.kind === 'relayed')).toBeLessThan(
      events.findIndex((e) => e.kind === 'content-start'),
    )
    vi.unstubAllGlobals()
  })

  it('emits reasoning before content without prefill/first-byte markers', async () => {
    const events: Array<string> = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        const body = new ReadableStream<Uint8Array>({
          start(controller) {
            const encoder = new TextEncoder()
            controller.enqueue(encoder.encode(': relayed\n\n'))
            controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"reasoning_content":"think"}}]}\n\n'))
            controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"hi"}}]}\n\n'))
            controller.enqueue(encoder.encode('data: [DONE]\n\n'))
            controller.close()
          },
        })
        return new Response(body, {
          status: 200,
          headers: {
            'content-type': 'text/event-stream',
            'x-llama-dash-queue-ms': '0',
          },
        })
      }),
    )

    for await (const _chunk of streamChatCompletion({
      messages: [{ role: 'user', content: 'hi' }],
      model: 'qwen',
      sampling,
      onEvent: (ev) => events.push(ev.kind),
    })) {
      // drain
    }

    expect(events).not.toContain('first-byte')
    expect(events).not.toContain('prefill-done')
    expect(events).not.toContain('reasoning-end')
    expect(events.indexOf('relayed')).toBeLessThan(events.indexOf('reasoning-start'))
    expect(events.indexOf('reasoning-start')).toBeLessThan(events.indexOf('content-start'))
    expect(events.indexOf('content-start')).toBeLessThan(events.indexOf('done'))
    vi.unstubAllGlobals()
  })
})
