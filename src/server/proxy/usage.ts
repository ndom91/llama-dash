export type Usage = {
  model: string | null
  promptTokens: number | null
  completionTokens: number | null
  totalTokens: number | null
  // Prompt-caching counters stay separate from prompt tokens because providers
  // may bill or report cache reads differently.
  cacheCreationTokens: number | null
  cacheReadTokens: number | null
  cacheReadTokensIncludedInPrompt?: boolean
  prefillMs?: number
  decodeMs?: number
}

export type UsageWithClose = Usage & {
  streamCloseMs: number | null
  firstOutputMs?: number | null
  outputSpanMs?: number | null
}

const emptyUsage = (): Usage => ({
  model: null,
  promptTokens: null,
  completionTokens: null,
  totalTokens: null,
  cacheCreationTokens: null,
  cacheReadTokens: null,
})

type RawJson = Record<string, unknown>

// Anthropic's message_start event wraps model + usage under `message`.
const asRecord = (v: unknown): RawJson | null => (v && typeof v === 'object' ? (v as RawJson) : null)

const pickModel = (body: RawJson): string | null => {
  if (typeof body.model === 'string') return body.model
  const msg = asRecord(body.message)
  if (msg && typeof msg.model === 'string') return msg.model
  const response = asRecord(body.response)
  if (response && typeof response.model === 'string') return response.model
  return null
}

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)

function pickTimings(body: RawJson): Pick<Usage, 'prefillMs' | 'decodeMs'> {
  const timings = asRecord(body.timings)
  const prompt = num(timings?.prompt_ms) ?? num(body['timings/prompt_ms'])
  const decode = num(timings?.predicted_ms) ?? num(body['timings/predicted_ms'])
  return {
    ...(prompt != null && prompt >= 0 ? { prefillMs: prompt } : {}),
    ...(decode != null && decode >= 0 ? { decodeMs: decode } : {}),
  }
}

const readUsageRecord = (rec: RawJson): Partial<Usage> => {
  const inputTokenDetails = asRecord(rec.input_tokens_details)
  const cachedTokens = inputTokenDetails ? num(inputTokenDetails.cached_tokens) : null
  return {
    promptTokens: num(rec.prompt_tokens) ?? num(rec.input_tokens),
    completionTokens: num(rec.completion_tokens) ?? num(rec.output_tokens),
    totalTokens: num(rec.total_tokens),
    cacheCreationTokens:
      num(rec.cache_creation_input_tokens) ?? (inputTokenDetails ? num(inputTokenDetails.cache_write_tokens) : null),
    cacheReadTokens: num(rec.cache_read_input_tokens) ?? cachedTokens,
    // OpenAI Responses includes cache reads in input_tokens; Anthropic's
    // cache_read_input_tokens is a separate counter.
    cacheReadTokensIncludedInPrompt: cachedTokens != null || undefined,
  }
}

const pickUsage = (body: RawJson): Partial<Usage> => {
  const u = asRecord(body.usage)
  if (u) return readUsageRecord(u)
  const msg = asRecord(body.message)
  if (msg) {
    const mu = asRecord(msg.usage)
    if (mu) return readUsageRecord(mu)
  }
  const response = asRecord(body.response)
  if (response) {
    const ru = asRecord(response.usage)
    if (ru) return readUsageRecord(ru)
  }
  const t = asRecord(body.timings)
  if (t) {
    return {
      promptTokens: num(t.prompt_n),
      completionTokens: num(t.predicted_n),
    }
  }
  if ('timings/prompt_n' in body || 'timings/predicted_n' in body) {
    return {
      promptTokens: num(body['timings/prompt_n']),
      completionTokens: num(body['timings/predicted_n']),
    }
  }
  return {}
}

export function usageFromJsonBody(text: string): Usage {
  const out = emptyUsage()
  try {
    const body = JSON.parse(text) as RawJson
    out.model = pickModel(body)
    Object.assign(out, pickUsage(body))
    Object.assign(out, pickTimings(body))
    if (out.totalTokens == null && out.promptTokens != null && out.completionTokens != null) {
      out.totalTokens = out.promptTokens + out.completionTokens
    }
  } catch {
    // non-JSON or truncated body — leave usage null
  }
  return out
}

/** Accumulates SSE chunks and pulls `model` / `usage` out of the stream. */
export class SseUsageScanner {
  private buf = ''
  private usage: Usage = emptyUsage()
  private doneAtMs: number | null = null
  private firstOutputAt: number | null = null
  private lastOutputAt: number | null = null

  constructor(private readonly startedAt?: number) {}

  feed(chunk: string, at: number) {
    this.buf += chunk
    // SSE events are separated by blank lines, including CRLF line endings.
    for (;;) {
      const separator = /\r?\n\r?\n/.exec(this.buf)
      if (!separator) break
      const event = this.buf.slice(0, separator.index)
      this.buf = this.buf.slice(separator.index + separator[0].length)
      this.processEvent(event, at)
    }
  }

  /** True once the stream's `data: [DONE]` terminator has been seen. */
  get sawDone(): boolean {
    return this.doneAtMs != null
  }

  done(closeAtMs?: number): UsageWithClose {
    if (this.buf.length > 0) {
      this.processEvent(this.buf, closeAtMs ?? Date.now())
      this.buf = ''
    }
    return {
      ...this.usage,
      streamCloseMs: this.doneAtMs != null && closeAtMs != null ? Math.max(0, closeAtMs - this.doneAtMs) : null,
      ...(this.firstOutputAt != null && this.startedAt != null
        ? {
            firstOutputMs: Math.max(0, this.firstOutputAt - this.startedAt),
            outputSpanMs: Math.max(0, (this.lastOutputAt ?? this.firstOutputAt) - this.firstOutputAt),
          }
        : {}),
    }
  }

  private processEvent(event: string, at: number) {
    for (const line of event.split('\n')) {
      if (!line.startsWith('data:')) continue
      const payload = line.slice(5).trim()
      if (!payload) continue
      if (payload === '[DONE]') {
        if (this.doneAtMs == null) this.doneAtMs = at
        continue
      }
      try {
        const body = JSON.parse(payload) as RawJson
        if (hasOutputDelta(body)) {
          this.firstOutputAt ??= at
          this.lastOutputAt = at
        }
        const model = pickModel(body)
        if (model && !this.usage.model) this.usage.model = model
        const u = pickUsage(body)
        Object.assign(this.usage, pickTimings(body))
        if (u.promptTokens != null) this.usage.promptTokens = u.promptTokens
        if (u.completionTokens != null) this.usage.completionTokens = u.completionTokens
        if (u.totalTokens != null) this.usage.totalTokens = u.totalTokens
        if (u.cacheCreationTokens != null) this.usage.cacheCreationTokens = u.cacheCreationTokens
        if (u.cacheReadTokens != null) this.usage.cacheReadTokens = u.cacheReadTokens
        if (u.cacheReadTokensIncludedInPrompt) this.usage.cacheReadTokensIncludedInPrompt = true
        // Anthropic and OpenAI Responses terminate streams with an explicit event rather than [DONE].
        if (
          (body.type === 'message_stop' ||
            body.type === 'response.completed' ||
            body.type === 'response.failed' ||
            body.type === 'response.incomplete') &&
          this.doneAtMs == null
        )
          this.doneAtMs = at
      } catch {
        // ignore malformed chunks
      }
    }
    if (this.usage.totalTokens == null && this.usage.promptTokens != null && this.usage.completionTokens != null) {
      this.usage.totalTokens = this.usage.promptTokens + this.usage.completionTokens
    }
  }
}

function hasOutputDelta(body: RawJson): boolean {
  if (body.type === 'response.output_item.added') {
    const item = asRecord(body.item)
    return item?.type === 'function_call' && typeof item.name === 'string' && item.name.length > 0
  }
  if (body.type === 'content_block_start') {
    const block = asRecord(body.content_block)
    return block?.type === 'tool_use' && typeof block.name === 'string' && block.name.length > 0
  }
  if (
    typeof body.type === 'string' &&
    [
      'response.output_text.delta',
      'response.reasoning_summary_text.delta',
      'response.reasoning_text.delta',
      'response.function_call_arguments.delta',
    ].includes(body.type)
  )
    return typeof body.delta === 'string' && body.delta.length > 0
  if (body.type === 'content_block_delta') {
    const delta = asRecord(body.delta)
    return Boolean(
      delta &&
        [delta.text, delta.thinking, delta.partial_json].some((value) => typeof value === 'string' && value.length > 0),
    )
  }
  if (!Array.isArray(body.choices)) return false
  return body.choices.some((choice: unknown) => {
    const delta = asRecord(asRecord(choice)?.delta)
    return Boolean(
      delta &&
        ([delta.content, delta.reasoning_content, delta.reasoning].some(
          (value) => typeof value === 'string' && value.length > 0,
        ) ||
          (Array.isArray(delta.tool_calls) && delta.tool_calls.length > 0)),
    )
  })
}
