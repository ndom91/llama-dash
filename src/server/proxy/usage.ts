export type Usage = {
  model: string | null
  promptTokens: number | null
  completionTokens: number | null
  totalTokens: number | null
  // Prompt-caching counters stay separate from prompt tokens because providers
  // may bill or report cache reads differently.
  cacheCreationTokens: number | null
  cacheReadTokens: number | null
}

export type UsageWithClose = Usage & {
  streamCloseMs: number | null
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

const readUsageRecord = (rec: RawJson): Partial<Usage> => {
  const inputTokenDetails = asRecord(rec.input_tokens_details)
  return {
    promptTokens: num(rec.prompt_tokens) ?? num(rec.input_tokens),
    completionTokens: num(rec.completion_tokens) ?? num(rec.output_tokens),
    totalTokens: num(rec.total_tokens),
    cacheCreationTokens: num(rec.cache_creation_input_tokens),
    cacheReadTokens:
      num(rec.cache_read_input_tokens) ?? (inputTokenDetails ? num(inputTokenDetails.cached_tokens) : null),
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

  feed(chunk: string, at: number) {
    this.buf += chunk
    // SSE events are separated by blank lines (\n\n)
    for (;;) {
      const idx = this.buf.indexOf('\n\n')
      if (idx === -1) break
      const event = this.buf.slice(0, idx)
      this.buf = this.buf.slice(idx + 2)
      this.processEvent(event, at)
    }
  }

  done(closeAtMs?: number): UsageWithClose {
    if (this.buf.length > 0) {
      this.processEvent(this.buf, closeAtMs ?? Date.now())
      this.buf = ''
    }
    return {
      ...this.usage,
      streamCloseMs: this.doneAtMs != null && closeAtMs != null ? Math.max(0, closeAtMs - this.doneAtMs) : null,
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
        const model = pickModel(body)
        if (model && !this.usage.model) this.usage.model = model
        const u = pickUsage(body)
        if (u.promptTokens != null) this.usage.promptTokens = u.promptTokens
        if (u.completionTokens != null) this.usage.completionTokens = u.completionTokens
        if (u.totalTokens != null) this.usage.totalTokens = u.totalTokens
        if (u.cacheCreationTokens != null) this.usage.cacheCreationTokens = u.cacheCreationTokens
        if (u.cacheReadTokens != null) this.usage.cacheReadTokens = u.cacheReadTokens
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
