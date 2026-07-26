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
    const events: Array<{ kind: string; atMs?: number }> = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        const body = new ReadableStream<Uint8Array>({
          start(controller) {
            const encoder = new TextEncoder()
            controller.enqueue(encoder.encode(': relayed at_ms=0\n\n'))
            controller.enqueue(encoder.encode(': respond at_ms=100\n\n'))
            controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"hi"}}]}\n\n'))
            controller.enqueue(encoder.encode('data: [DONE]\n\n'))
            controller.close()
          },
        })
        return new Response(body, {
          status: 200,
          headers: {
            'content-type': 'text/event-stream',
            'x-llama-dash-queued': 'false',
          },
        })
      }),
    )

    const chunks = []
    for await (const chunk of streamChatCompletion({
      messages: [{ role: 'user', content: 'hi' }],
      model: 'llama3',
      sampling,
      onEvent: (ev) => {
        if (ev.kind === 'relayed' || ev.kind === 'content-start') {
          events.push({ kind: ev.kind, atMs: ev.atMs })
        } else {
          events.push({ kind: ev.kind })
        }
      },
    })) {
      chunks.push(chunk)
    }

    expect(events[0]?.kind).toBe('request-sent')
    expect(events.map((e) => e.kind)).toContain('started')
    expect(events.find((e) => e.kind === 'relayed')?.atMs).toBe(0)
    expect(events.find((e) => e.kind === 'content-start')?.atMs).toBe(100)
    expect(events.map((e) => e.kind)).not.toContain('first-byte')
    expect(events.map((e) => e.kind)).not.toContain('prefill-done')
    const kinds = events.map((e) => e.kind)
    expect(kinds.indexOf('request-sent')).toBeLessThan(kinds.indexOf('started'))
    expect(kinds.indexOf('started')).toBeLessThan(kinds.indexOf('relayed'))
    expect(kinds.indexOf('relayed')).toBeLessThan(kinds.indexOf('content-start'))
    expect(kinds).not.toContain('reasoning-start')
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
            controller.enqueue(encoder.encode(': respond\n\n'))
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

  it('emits reasoning before content from proxy phase comments', async () => {
    const events: Array<{ kind: string; atMs?: number }> = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        const body = new ReadableStream<Uint8Array>({
          start(controller) {
            const encoder = new TextEncoder()
            controller.enqueue(encoder.encode(': relayed at_ms=0\n\n'))
            controller.enqueue(encoder.encode(': reason at_ms=80\n\n'))
            controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"reasoning_content":"think"}}]}\n\n'))
            controller.enqueue(encoder.encode(': respond at_ms=180\n\n'))
            controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"hi"}}]}\n\n'))
            controller.enqueue(encoder.encode('data: [DONE]\n\n'))
            controller.close()
          },
        })
        return new Response(body, {
          status: 200,
          headers: {
            'content-type': 'text/event-stream',
            'x-llama-dash-queued': 'false',
          },
        })
      }),
    )

    for await (const _chunk of streamChatCompletion({
      messages: [{ role: 'user', content: 'hi' }],
      model: 'qwen',
      sampling,
      onEvent: (ev) => {
        if (ev.kind === 'relayed' || ev.kind === 'reasoning-start' || ev.kind === 'content-start') {
          events.push({ kind: ev.kind, atMs: ev.atMs })
        } else {
          events.push({ kind: ev.kind })
        }
      },
    })) {
      // drain
    }

    const kinds = events.map((e) => e.kind)
    expect(kinds).not.toContain('first-byte')
    expect(kinds).not.toContain('prefill-done')
    expect(kinds).not.toContain('reasoning-end')
    expect(events.find((e) => e.kind === 'relayed')?.atMs).toBe(0)
    expect(events.find((e) => e.kind === 'reasoning-start')?.atMs).toBe(80)
    expect(events.find((e) => e.kind === 'content-start')?.atMs).toBe(180)
    expect(kinds.indexOf('relayed')).toBeLessThan(kinds.indexOf('reasoning-start'))
    expect(kinds.indexOf('reasoning-start')).toBeLessThan(kinds.indexOf('content-start'))
    expect(kinds.indexOf('content-start')).toBeLessThan(kinds.indexOf('done'))
    vi.unstubAllGlobals()
  })

  it('non-stream prefers timings_llama_dash body over phase headers', async () => {
    const events: Array<{
      kind: string
      queueMs?: number
      at?: number
      atMs?: number
      inferred?: boolean
    }> = []
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              choices: [
                {
                  message: { role: 'assistant', content: 'hello', reasoning_content: 'think' },
                  finish_reason: 'stop',
                },
              ],
              usage: { prompt_tokens: 3, completion_tokens: 1 },
              timings: { prompt_ms: 20, predicted_ms: 100 },
              timings_llama_dash: {
                queued: true,
                queue_ms: 400,
                reason_ms: 50,
                respond_ms: 120,
                model_loading_ms: 10,
                prefill_ms: 20,
                reasoning_ms: 70,
                response_ms: 30,
              },
            }),
            {
              status: 200,
              headers: {
                'content-type': 'application/json',
                // Stale/wrong headers — body should win
                'x-llama-dash-queued': 'false',
                'x-llama-dash-queue-ms': '1',
                'x-llama-dash-reason-ms': '999',
                'x-llama-dash-respond-ms': '999',
              },
            },
          ),
      ),
    )

    for await (const _chunk of streamChatCompletion({
      messages: [{ role: 'user', content: 'hi' }],
      model: 'llama3',
      sampling: { ...sampling, stream: false },
      onEvent: (ev) => {
        if (ev.kind === 'queued' || ev.kind === 'relayed') {
          events.push({
            kind: ev.kind,
            queueMs: ev.queueMs,
            at: ev.at,
            atMs: 'atMs' in ev ? ev.atMs : undefined,
            inferred: ev.inferred,
          })
        } else if (ev.kind === 'started' || ev.kind === 'reasoning-start' || ev.kind === 'content-start') {
          events.push({
            kind: ev.kind,
            at: 'at' in ev ? ev.at : undefined,
            atMs: 'atMs' in ev ? ev.atMs : undefined,
            inferred: 'inferred' in ev ? ev.inferred : undefined,
          })
        } else {
          events.push({ kind: ev.kind })
        }
      },
    })) {
      // drain
    }

    expect(events.find((e) => e.kind === 'queued')?.queueMs).toBe(400)
    expect(events.find((e) => e.kind === 'started')).toMatchObject({ inferred: true })
    expect(events.find((e) => e.kind === 'relayed')).toMatchObject({ inferred: true, atMs: 0 })
    expect(events.find((e) => e.kind === 'reasoning-start')).toMatchObject({ inferred: true, atMs: 50 })
    expect(events.find((e) => e.kind === 'content-start')).toMatchObject({ inferred: true, atMs: 120 })
    const relayed = events.find((e) => e.kind === 'relayed')!
    const reason = events.find((e) => e.kind === 'reasoning-start')!
    const respond = events.find((e) => e.kind === 'content-start')!
    expect(reason.at! - relayed.at!).toBe(50)
    expect(respond.at! - relayed.at!).toBe(120)
    vi.unstubAllGlobals()
  })

  it('non-stream reconstructs full tape including REASON/RESPOND from phase headers', async () => {
    const events: Array<{ kind: string; queueMs?: number; at?: number }> = []
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              choices: [
                {
                  message: { role: 'assistant', content: 'hello', reasoning_content: 'think' },
                  finish_reason: 'stop',
                },
              ],
              usage: { prompt_tokens: 3, completion_tokens: 1 },
              timings: { prompt_ms: 20, predicted_ms: 100 },
            }),
            {
              status: 200,
              headers: {
                'content-type': 'application/json',
                'x-llama-dash-queued': 'true',
                'x-llama-dash-queue-ms': '250',
                'x-llama-dash-reason-ms': '80',
                'x-llama-dash-respond-ms': '180',
              },
            },
          ),
      ),
    )

    const chunks = []
    for await (const chunk of streamChatCompletion({
      messages: [{ role: 'user', content: 'hi' }],
      model: 'llama3',
      sampling: { ...sampling, stream: false },
      onEvent: (ev) => {
        if (ev.kind === 'queued' || ev.kind === 'relayed') {
          events.push({ kind: ev.kind, queueMs: ev.queueMs, at: ev.at })
        } else if (ev.kind === 'reasoning-start' || ev.kind === 'content-start') {
          events.push({ kind: ev.kind, at: ev.at })
        } else {
          events.push({ kind: ev.kind })
        }
      },
    })) {
      chunks.push(chunk)
    }

    expect(events.map((e) => e.kind)).toEqual([
      'request-sent',
      'started',
      'queued',
      'relayed',
      'reasoning-start',
      'content-start',
      'chunk',
      'usage',
      'timings',
      'done',
      'closed',
    ])
    expect(events.find((e) => e.kind === 'queued')?.queueMs).toBe(250)
    const relayed = events.find((e) => e.kind === 'relayed')!
    const reason = events.find((e) => e.kind === 'reasoning-start')!
    const respond = events.find((e) => e.kind === 'content-start')!
    expect(reason.at! - relayed.at!).toBe(80)
    expect(respond.at! - relayed.at!).toBe(180)
    expect(chunks.some((c) => c.content === 'hello')).toBe(true)
    vi.unstubAllGlobals()
  })

  it('plain JSON non-stream yields content before done events', async () => {
    const events: Array<string> = []
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              choices: [{ message: { role: 'assistant', content: 'plain-hi' }, finish_reason: 'stop' }],
              usage: { prompt_tokens: 1, completion_tokens: 1 },
            }),
            {
              status: 200,
              headers: {
                'content-type': 'application/json',
                'x-llama-dash-queued': 'false',
                'x-llama-dash-queue-ms': '0',
              },
            },
          ),
      ),
    )

    const chunks: Array<{ content: string; done?: boolean }> = []
    let contentBeforeDone = false
    for await (const chunk of streamChatCompletion({
      messages: [{ role: 'user', content: 'hi' }],
      model: 'llama3',
      sampling: { ...sampling, stream: false },
      onEvent: (ev) => {
        if (ev.kind === 'done') {
          contentBeforeDone = chunks.some((c) => c.content === 'plain-hi')
        }
        events.push(ev.kind)
      },
    })) {
      chunks.push(chunk)
    }

    expect(contentBeforeDone).toBe(true)
    expect(chunks[0]?.content).toBe('plain-hi')
    expect(events).toEqual(['request-sent', 'started', 'relayed', 'chunk', 'usage', 'done', 'closed'])
    expect(events.indexOf('chunk')).toBeLessThan(events.indexOf('done'))
    vi.unstubAllGlobals()
  })
})
