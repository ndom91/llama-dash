export type ChatMessage = {
  id: string
  role: 'system' | 'user' | 'assistant'
  content: string
  reasoningContent?: string
  reasoningTimeMs?: number
  metrics?: MessageMetrics
}

export type MessageMetrics = {
  totalMs?: number
  tokIn?: number
  tokOut?: number
  tokPerSec?: number
}

export type SamplingParams = {
  temperature: number
  topP: number
  topK: number
  maxTokens: number
  frequencyPenalty: number
  presencePenalty: number
  stopSequences: Array<string>
  seed: number | null
  n: number
  stream: boolean
  responseFormat: 'text' | 'json'
  logprobs: boolean
}

export type StreamEvent =
  | { kind: 'request-sent'; body: Record<string, unknown>; url: string; at: number }
  /** Server accepted the request (SSE headers), or request-sent clock for long-poll JSON. Tape: START */
  | { kind: 'started'; at: number; inferred?: boolean }
  | { kind: 'queued'; position: number; eta: string; model: string; at: number; queueMs?: number; inferred?: boolean }
  /** `atMs` is ms after RELAY (RELAY itself is always 0). Never wall-clock epoch. */
  | { kind: 'relayed'; at: number; atMs?: number; queueMs?: number; inferred?: boolean }
  | { kind: 'reasoning-start'; at: number; atMs?: number; inferred?: boolean }
  | { kind: 'content-start'; at: number; atMs?: number; inferred?: boolean }
  | { kind: 'timings'; promptMs?: number; predictedMs?: number; at: number }
  | { kind: 'chunk'; content: string; reasoningContent?: string; at: number }
  | { kind: 'usage'; promptTokens?: number; completionTokens?: number; at: number }
  | { kind: 'done'; finishReason?: string; at: number }
  | { kind: 'closed'; at: number }
  | { kind: 'error'; message: string; at: number }

export type StreamChunk = {
  content: string
  reasoningContent?: string
  done: boolean
  finishReason?: string
  promptTokens?: number
  completionTokens?: number
  promptMs?: number
  predictedMs?: number
}

export type StreamRequestOptions = {
  messages: Array<{ role: string; content: string }>
  model: string
  sampling: SamplingParams
  includeTimings?: boolean
  signal?: AbortSignal
  apiKey?: string
  onEvent?: (ev: StreamEvent) => void
}

function buildBody(opts: StreamRequestOptions): Record<string, unknown> {
  const s = opts.sampling
  const body: Record<string, unknown> = {
    model: opts.model,
    messages: opts.messages,
    stream: s.stream,
    temperature: s.temperature,
    top_p: s.topP,
    top_k: s.topK,
    max_tokens: s.maxTokens,
    frequency_penalty: s.frequencyPenalty,
    presence_penalty: s.presencePenalty,
    n: s.n,
  }
  if (opts.includeTimings) body.timings_per_token = true
  if (s.stopSequences.length > 0) body.stop = s.stopSequences
  if (s.seed != null) body.seed = s.seed
  if (s.responseFormat === 'json') body.response_format = { type: 'json_object' }
  if (s.logprobs) body.logprobs = true
  return body
}

export async function* streamChatCompletion(opts: StreamRequestOptions): AsyncGenerator<StreamChunk> {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
  }
  if (opts.apiKey) headers.authorization = `Bearer ${opts.apiKey}`

  const body = buildBody(opts)
  const url = '/v1/chat/completions'
  const requestAt = Date.now()
  // Client is about to POST; SSE path fires START on early-commit headers.
  // Long-poll JSON reconstructs START from this clock (headers arrive with body).
  opts.onEvent?.({ kind: 'request-sent', body, url, at: requestAt })

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: opts.signal,
  })

  if (!res.ok) {
    const errBody = await res.text().catch(() => '')
    const msg = `${res.status}: ${errBody.slice(0, 300)}`
    opts.onEvent?.({ kind: 'error', message: msg, at: Date.now() })
    throw new Error(msg)
  }

  if (!res.body) {
    const msg = 'No response body'
    opts.onEvent?.({ kind: 'error', message: msg, at: Date.now() })
    throw new Error(msg)
  }

  const isSse = (res.headers.get('content-type') ?? '').includes('text/event-stream')
  // Non-stream / native JSON: long-poll response — reconstruct progress from headers.
  if (!isSse) {
    yield* readJsonCompletion(res, opts, requestAt)
    return
  }

  // START: llama-dash early-committed the SSE progress tape.
  opts.onEvent?.({ kind: 'started', at: Date.now() })

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let sawRelayed = false
  let sawQueued = false
  let sawReason = false
  let sawRespond = false
  let sawDone = false

  const emitChunkEvents = (chunk: StreamChunk) => {
    const hasReasoning = Boolean(chunk.reasoningContent)
    const hasContent = Boolean(chunk.content)

    if (hasContent || hasReasoning) {
      opts.onEvent?.({
        kind: 'chunk',
        content: chunk.content,
        reasoningContent: chunk.reasoningContent,
        at: Date.now(),
      })
    }
    if (chunk.promptTokens != null || chunk.completionTokens != null) {
      opts.onEvent?.({
        kind: 'usage',
        promptTokens: chunk.promptTokens,
        completionTokens: chunk.completionTokens,
        at: Date.now(),
      })
    }
    if (chunk.promptMs != null || chunk.predictedMs != null) {
      opts.onEvent?.({
        kind: 'timings',
        promptMs: chunk.promptMs,
        predictedMs: chunk.predictedMs,
        at: Date.now(),
      })
    }
    if (chunk.done && !sawDone) {
      sawDone = true
      opts.onEvent?.({ kind: 'done', finishReason: chunk.finishReason, at: Date.now() })
    }
  }

  try {
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        const queueStatus = parseQueueStatusLine(line)
        if (queueStatus) {
          if (!sawQueued) {
            sawQueued = true
            // Later `: queued` keep-alives update position/ETA on the wire only.
            opts.onEvent?.({ kind: 'queued', ...queueStatus, at: Date.now() })
          }
          continue
        }
        if (parseRelayedStatusLine(line)) {
          if (!sawRelayed) {
            sawRelayed = true
            const atMs = parseAtMs(line)
            opts.onEvent?.({
              kind: 'relayed',
              at: Date.now(),
              ...(atMs != null ? { atMs } : {}),
            })
          }
          continue
        }
        if (parseReasonStatusLine(line)) {
          if (!sawReason) {
            sawReason = true
            const atMs = parseAtMs(line)
            opts.onEvent?.({
              kind: 'reasoning-start',
              at: Date.now(),
              ...(atMs != null ? { atMs } : {}),
            })
          }
          continue
        }
        if (parseRespondStatusLine(line)) {
          if (!sawRespond) {
            sawRespond = true
            const atMs = parseAtMs(line)
            opts.onEvent?.({
              kind: 'content-start',
              at: Date.now(),
              ...(atMs != null ? { atMs } : {}),
            })
          }
          continue
        }

        const errorMessage = parseSseErrorLine(line)
        if (errorMessage) {
          opts.onEvent?.({ kind: 'error', message: errorMessage, at: Date.now() })
          throw new Error(errorMessage)
        }

        const chunk = parseSseLine(line)
        if (!chunk) continue
        emitChunkEvents(chunk)
        yield chunk
      }
    }

    const tail = decoder.decode()
    if (tail) buffer += tail
    if (buffer.trim()) {
      const chunk = parseSseLine(buffer)
      if (chunk) {
        emitChunkEvents(chunk)
        yield chunk
      }
    }

    if (!sawDone) {
      sawDone = true
      opts.onEvent?.({ kind: 'done', finishReason: 'stop', at: Date.now() })
    }
    opts.onEvent?.({ kind: 'closed', at: Date.now() })
  } finally {
    reader.releaseLock()
  }
}

/**
 * Native JSON completion (stream:false long-poll). Reconstructs the event tape
 * from `timings_llama_dash` in the body (preferred) or queue/phase headers.
 * Phase `atMs` values are ms after RELAY (RELAY = 0), never wall-clock epoch.
 */
async function* readJsonCompletion(
  res: Response,
  opts: StreamRequestOptions,
  requestAt: number,
): AsyncGenerator<StreamChunk> {
  const text = await res.text()
  let parsed: unknown
  try {
    parsed = text.trim() ? JSON.parse(text) : {}
  } catch {
    const msg = 'Invalid JSON response'
    opts.onEvent?.({ kind: 'error', message: msg, at: Date.now() })
    throw new Error(msg)
  }

  const fromBody = readLlamaDashTimingsFromBody(parsed)
  const queueMs = fromBody?.queue_ms ?? parseHeaderMs(res.headers.get('x-llama-dash-queue-ms')) ?? 0
  const wasQueued = fromBody?.queued === true || res.headers.get('x-llama-dash-queued') === 'true' || queueMs > 0
  const reasonOffset = fromBody?.reason_ms ?? parseHeaderMs(res.headers.get('x-llama-dash-reason-ms'))
  const respondOffset = fromBody?.respond_ms ?? parseHeaderMs(res.headers.get('x-llama-dash-respond-ms'))

  // Long-poll: tape is reconstructed after the body arrives — mark as inferred.
  opts.onEvent?.({ kind: 'started', at: requestAt, inferred: true })
  if (wasQueued) {
    opts.onEvent?.({
      kind: 'queued',
      position: 1,
      eta: `${Math.round(queueMs / 1000)}s`,
      model: opts.model,
      at: requestAt,
      queueMs,
      inferred: true,
    })
  }
  const relayedAt = requestAt + queueMs
  opts.onEvent?.({
    kind: 'relayed',
    at: relayedAt,
    atMs: 0,
    queueMs,
    inferred: true,
  })
  if (reasonOffset != null) {
    opts.onEvent?.({
      kind: 'reasoning-start',
      at: relayedAt + reasonOffset,
      atMs: reasonOffset,
      inferred: true,
    })
  }
  if (respondOffset != null) {
    opts.onEvent?.({
      kind: 'content-start',
      at: relayedAt + respondOffset,
      atMs: respondOffset,
      inferred: true,
    })
  }

  let chunk: StreamChunk
  try {
    chunk = completionToChunk(parsed)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    opts.onEvent?.({ kind: 'error', message: msg, at: Date.now() })
    throw err
  }

  // Prefer llama-dash prefill when present; keep upstream predicted_ms for tok/s.
  if (fromBody?.prefill_ms != null) chunk.promptMs = fromBody.prefill_ms

  if (chunk.content || chunk.reasoningContent) {
    opts.onEvent?.({
      kind: 'chunk',
      content: chunk.content,
      reasoningContent: chunk.reasoningContent,
      at: Date.now(),
    })
  }
  if (chunk.promptTokens != null || chunk.completionTokens != null) {
    opts.onEvent?.({
      kind: 'usage',
      promptTokens: chunk.promptTokens,
      completionTokens: chunk.completionTokens,
      at: Date.now(),
    })
  }
  if (chunk.promptMs != null || chunk.predictedMs != null) {
    opts.onEvent?.({
      kind: 'timings',
      promptMs: chunk.promptMs,
      predictedMs: chunk.predictedMs,
      at: Date.now(),
    })
  }
  // Yield before done/closed so consumers can apply content first.
  yield chunk
  opts.onEvent?.({ kind: 'done', finishReason: chunk.finishReason ?? 'stop', at: Date.now() })
  opts.onEvent?.({ kind: 'closed', at: Date.now() })
}

function parseHeaderMs(raw: string | null): number | null {
  if (raw == null || raw === '') return null
  const n = Number(raw)
  return Number.isFinite(n) && n >= 0 ? n : null
}

type LlamaDashTimingsBody = {
  queued: boolean
  queue_ms: number
  reason_ms: number | null
  respond_ms: number | null
  model_loading_ms: number | null
  prefill_ms: number | null
  reasoning_ms: number | null
  response_ms: number | null
}

function readLlamaDashTimingsFromBody(body: unknown): LlamaDashTimingsBody | null {
  if (!body || typeof body !== 'object') return null
  const raw = (body as Record<string, unknown>).timings_llama_dash
  if (!raw || typeof raw !== 'object') return null
  const t = raw as Record<string, unknown>
  const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)
  const queueMs = typeof t.queue_ms === 'number' && Number.isFinite(t.queue_ms) ? Math.max(0, t.queue_ms) : 0
  return {
    queued: t.queued === true || queueMs > 0,
    queue_ms: queueMs,
    reason_ms: num(t.reason_ms),
    respond_ms: num(t.respond_ms),
    model_loading_ms: num(t.model_loading_ms),
    prefill_ms: num(t.prefill_ms),
    reasoning_ms: num(t.reasoning_ms),
    response_ms: num(t.response_ms),
  }
}

function completionToChunk(parsed: unknown): StreamChunk {
  const body = parsed as {
    error?: { message?: string }
    choices?: Array<{
      message?: { content?: string; reasoning_content?: string }
      finish_reason?: string
    }>
    usage?: { prompt_tokens?: number; completion_tokens?: number }
    timings?: { prompt_ms?: number; predicted_ms?: number; prompt_n?: number; predicted_n?: number }
  }
  if (body.error?.message) {
    throw new Error(body.error.message)
  }
  const message = body.choices?.[0]?.message
  return {
    content: message?.content ?? '',
    reasoningContent: message?.reasoning_content,
    done: true,
    finishReason: body.choices?.[0]?.finish_reason ?? 'stop',
    promptTokens: body.usage?.prompt_tokens ?? body.timings?.prompt_n,
    completionTokens: body.usage?.completion_tokens ?? body.timings?.predicted_n,
    promptMs: body.timings?.prompt_ms,
    predictedMs: body.timings?.predicted_ms,
  }
}

function parseQueueStatusLine(line: string): { position: number; eta: string; model: string } | null {
  const trimmed = line.trim()
  if (!trimmed.startsWith(': queued ')) return null
  const position = /position=(\d+)/.exec(trimmed)?.[1]
  const eta = /eta=(\S+)/.exec(trimmed)?.[1]
  const model = /model=(\S+)/.exec(trimmed)?.[1]
  if (!position || !eta || !model) return null
  return { position: Number(position), eta, model }
}

function parseRelayedStatusLine(line: string): boolean {
  const trimmed = line.trim()
  return trimmed === ': relayed' || trimmed.startsWith(': relayed ')
}

function parseReasonStatusLine(line: string): boolean {
  const trimmed = line.trim()
  return trimmed === ': reason' || trimmed.startsWith(': reason ')
}

function parseRespondStatusLine(line: string): boolean {
  const trimmed = line.trim()
  return trimmed === ': respond' || trimmed.startsWith(': respond ')
}

function parseAtMs(line: string): number | null {
  const at = /at_ms=(\d+)/.exec(line.trim())?.[1]
  return at != null ? Number(at) : null
}

function parseSseErrorLine(line: string): string | null {
  const trimmed = line.trim()
  if (!trimmed.startsWith('data: ')) return null
  const data = trimmed.slice(6)
  if (data === '[DONE]') return null
  try {
    const parsed = JSON.parse(data) as { error?: { message?: string; type?: string } }
    if (!parsed.error?.message) return null
    return parsed.error.type ? `${parsed.error.type}: ${parsed.error.message}` : parsed.error.message
  } catch {
    return null
  }
}

function parseSseLine(line: string): StreamChunk | null {
  const trimmed = line.trim()
  if (!trimmed?.startsWith('data: ')) return null

  const data = trimmed.slice(6)
  if (data === '[DONE]') return { content: '', done: true }

  try {
    const parsed = JSON.parse(data)
    if (parsed.error) return null

    const delta = parsed.choices?.[0]?.delta
    const message = parsed.choices?.[0]?.message
    const finishReason = parsed.choices?.[0]?.finish_reason
    const usage = parsed.usage

    // Progress-wrapped non-stream: one full `message` object, not deltas.
    // Leave done=false so `[DONE]` (next event) marks completion after content is applied.
    if (!delta && message) {
      return {
        content: message.content ?? '',
        reasoningContent: message.reasoning_content,
        done: false,
        finishReason: finishReason ?? 'stop',
        promptTokens: usage?.prompt_tokens ?? parsed.timings?.prompt_n,
        completionTokens: usage?.completion_tokens ?? parsed.timings?.predicted_n,
        promptMs: parsed.timings?.prompt_ms,
        predictedMs: parsed.timings?.predicted_ms,
      }
    }

    if (!delta && !usage && !finishReason) return null
    return {
      content: delta?.content ?? '',
      reasoningContent: delta?.reasoning_content,
      done: Boolean(finishReason),
      finishReason: finishReason ?? undefined,
      promptTokens: usage?.prompt_tokens ?? parsed.timings?.prompt_n,
      completionTokens: usage?.completion_tokens ?? parsed.timings?.predicted_n,
      promptMs: parsed.timings?.prompt_ms,
      predictedMs: parsed.timings?.predicted_ms,
    }
  } catch {
    return null
  }
}
