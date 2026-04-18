export type Usage = {
  model: string | null
  promptTokens: number | null
  completionTokens: number | null
  totalTokens: number | null
}

const emptyUsage = (): Usage => ({
  model: null,
  promptTokens: null,
  completionTokens: null,
  totalTokens: null,
})

type RawJson = Record<string, unknown>

const pickModel = (body: RawJson): string | null => (typeof body.model === 'string' ? body.model : null)

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)

const pickUsage = (body: RawJson): Partial<Usage> => {
  const u = body.usage
  if (u && typeof u === 'object') {
    const rec = u as Record<string, unknown>
    return {
      promptTokens: num(rec.prompt_tokens) ?? num(rec.input_tokens),
      completionTokens: num(rec.completion_tokens) ?? num(rec.output_tokens),
      totalTokens: num(rec.total_tokens),
    }
  }
  const t = body.timings
  if (t && typeof t === 'object') {
    const rec = t as Record<string, unknown>
    return {
      promptTokens: num(rec.prompt_n),
      completionTokens: num(rec.predicted_n),
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

  feed(chunk: string) {
    this.buf += chunk
    // SSE events are separated by blank lines (\n\n)
    for (;;) {
      const idx = this.buf.indexOf('\n\n')
      if (idx === -1) break
      const event = this.buf.slice(0, idx)
      this.buf = this.buf.slice(idx + 2)
      this.processEvent(event)
    }
  }

  done(): Usage {
    if (this.buf.length > 0) {
      this.processEvent(this.buf)
      this.buf = ''
    }
    return this.usage
  }

  private processEvent(event: string) {
    for (const line of event.split('\n')) {
      if (!line.startsWith('data:')) continue
      const payload = line.slice(5).trim()
      if (!payload || payload === '[DONE]') continue
      try {
        const body = JSON.parse(payload) as RawJson
        const model = pickModel(body)
        if (model && !this.usage.model) this.usage.model = model
        const u = pickUsage(body)
        if (u.promptTokens != null) this.usage.promptTokens = u.promptTokens
        if (u.completionTokens != null) this.usage.completionTokens = u.completionTokens
        if (u.totalTokens != null) this.usage.totalTokens = u.totalTokens
      } catch {
        // ignore malformed chunks
      }
    }
    if (this.usage.totalTokens == null && this.usage.promptTokens != null && this.usage.completionTokens != null) {
      this.usage.totalTokens = this.usage.promptTokens + this.usage.completionTokens
    }
  }
}
