import { deriveDisplayPhases } from '../../lib/timing-phases.ts'

export { deriveDisplayPhases } from '../../lib/timing-phases.ts'

export type Usage = {
  model: string | null
  promptTokens: number | null
  completionTokens: number | null
  // Anthropic prompt-caching counters. Cached prompt tokens are billed at a
  // different rate (creation ~1.25x, read ~0.1x of input) so we track them
  // separately rather than folding into promptTokens.
  cacheCreationTokens: number | null
  cacheReadTokens: number | null
}

/** Ephemeral prompt+completion sum for TPM / stats — never persisted. */
export function usageTokenSum(usage: Pick<Usage, 'promptTokens' | 'completionTokens'>): number | null {
  if (usage.promptTokens == null && usage.completionTokens == null) return null
  return (usage.promptTokens ?? 0) + (usage.completionTokens ?? 0)
}

/**
 * Request phase timings persisted on the log row / returned by the scanner.
 *
 * Display model (always show labels; 0/null → "—"):
 *   queue + modelLoading + prefill + reasoning + response + other = duration
 *
 * - prefill = llama.cpp timings.prompt_ms
 * - modelLoading = (RELAY → REASON|RESPOND wall) − prefill
 * - reasoning = wall REASON→RESPOND (null unless both exist)
 * - response = timings.predicted_ms − reasoning (or predicted_ms if no reasoning)
 */
export type UsageWithClose = Usage & {
  modelLoadingMs: number | null
  prefillMs: number | null
  reasoningMs: number | null
  responseMs: number | null
  /** @deprecated kept null for newer rows; not shown in UI */
  decodeMs: number | null
  /** @deprecated kept null for newer rows; not shown in UI */
  streamCloseMs: number | null
  /** Raw llama.cpp timings.prompt_ms */
  gpuPrefillMs: number | null
  /** Raw llama.cpp timings.predicted_ms */
  gpuDecodeMs: number | null
}

export type GpuTimings = {
  gpuPrefillMs: number | null
  gpuDecodeMs: number | null
}

const emptyUsage = (): Usage => ({
  model: null,
  promptTokens: null,
  completionTokens: null,
  cacheCreationTokens: null,
  cacheReadTokens: null,
})

const emptyGpuTimings = (): GpuTimings => ({
  gpuPrefillMs: null,
  gpuDecodeMs: null,
})

type RawJson = Record<string, unknown>

const asRecord = (v: unknown): RawJson | null => (v && typeof v === 'object' ? (v as RawJson) : null)

const pickModel = (body: RawJson): string | null => {
  if (typeof body.model === 'string') return body.model
  const msg = asRecord(body.message)
  if (msg && typeof msg.model === 'string') return msg.model
  return null
}

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)

const readUsageRecord = (rec: RawJson): Partial<Usage> => ({
  promptTokens: num(rec.prompt_tokens) ?? num(rec.input_tokens),
  completionTokens: num(rec.completion_tokens) ?? num(rec.output_tokens),
  cacheCreationTokens: num(rec.cache_creation_input_tokens),
  cacheReadTokens: num(rec.cache_read_input_tokens),
})

const pickUsage = (body: RawJson): Partial<Usage> => {
  const u = asRecord(body.usage)
  if (u) return readUsageRecord(u)
  const msg = asRecord(body.message)
  if (msg) {
    const mu = asRecord(msg.usage)
    if (mu) return readUsageRecord(mu)
  }
  const t = asRecord(body.timings)
  if (t) {
    return {
      promptTokens: num(t.prompt_n),
      completionTokens: num(t.predicted_n),
    }
  }
  return {}
}

export function pickGpuTimings(body: RawJson): GpuTimings {
  const t = asRecord(body.timings)
  if (!t) return emptyGpuTimings()
  return {
    gpuPrefillMs: num(t.prompt_ms),
    gpuDecodeMs: num(t.predicted_ms),
  }
}

type TokenKind = 'reasoning' | 'content'

function tokenKind(body: RawJson): TokenKind | null {
  const choices = body.choices
  if (Array.isArray(choices)) {
    for (const choice of choices) {
      const delta = asRecord(asRecord(choice)?.delta)
      if (!delta) continue
      if (typeof delta.reasoning_content === 'string' && delta.reasoning_content.length > 0) return 'reasoning'
      if (typeof delta.reasoning === 'string' && delta.reasoning.length > 0) return 'reasoning'
      if (typeof delta.content === 'string' && delta.content.length > 0) return 'content'
    }
  }

  if (body.type === 'content_block_delta') {
    const delta = asRecord(body.delta)
    if (!delta) return null
    if (delta.type === 'thinking_delta' && typeof delta.thinking === 'string' && delta.thinking.length > 0) {
      return 'reasoning'
    }
    if (delta.type === 'text_delta' && typeof delta.text === 'string' && delta.text.length > 0) return 'content'
  }

  return null
}

export function usageFromJsonBody(text: string): Usage & GpuTimings {
  const out: Usage & GpuTimings = { ...emptyUsage(), ...emptyGpuTimings() }
  try {
    const body = JSON.parse(text) as RawJson
    out.model = pickModel(body)
    Object.assign(out, pickUsage(body))
    Object.assign(out, pickGpuTimings(body))
  } catch {
    // non-JSON or truncated body — leave usage null
  }
  return out
}

/** Non-SSE JSON responses: GPU phases only (no RELAY→token wall markers). */
export function usageWithDisplayPhases(base: Usage & GpuTimings): UsageWithClose {
  return {
    ...base,
    ...deriveDisplayPhases({
      relayToFirstTokenMs: null,
      gpuPrefillMs: base.gpuPrefillMs,
      gpuDecodeMs: base.gpuDecodeMs,
      reasoningMs: null,
    }),
    decodeMs: null,
    streamCloseMs: null,
  }
}

/**
 * Accumulates SSE chunks, pulls usage/GPU timings, and derives display phases.
 * `dispatchAtMs` is RELAY time (backend dispatch).
 */
export class SseUsageScanner {
  private buf = ''
  private usage: Usage = emptyUsage()
  private gpu: GpuTimings = emptyGpuTimings()
  /** First reasoning token (REASON). */
  private reasoningStartAtMs: number | null = null
  /** First content token (RESPOND). */
  private firstContentAtMs: number | null = null
  private doneAtMs: number | null = null

  constructor(private readonly dispatchAtMs: number) {}

  feed(chunk: string, at: number) {
    this.buf += chunk
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

    // Model-loading end: REASON, else RESPOND; unavailable if neither.
    const firstTokenAt = this.reasoningStartAtMs ?? this.firstContentAtMs
    const relayToFirstTokenMs = firstTokenAt != null ? Math.max(0, firstTokenAt - this.dispatchAtMs) : null

    // Reasoning only when both REASON and RESPOND exist.
    const reasoningMs =
      this.reasoningStartAtMs != null && this.firstContentAtMs != null
        ? Math.max(0, this.firstContentAtMs - this.reasoningStartAtMs)
        : null

    const phases = deriveDisplayPhases({
      relayToFirstTokenMs,
      gpuPrefillMs: this.gpu.gpuPrefillMs,
      gpuDecodeMs: this.gpu.gpuDecodeMs,
      reasoningMs,
    })

    return {
      ...this.usage,
      ...this.gpu,
      ...phases,
      decodeMs: null,
      streamCloseMs: null,
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
        if (u.cacheCreationTokens != null) this.usage.cacheCreationTokens = u.cacheCreationTokens
        if (u.cacheReadTokens != null) this.usage.cacheReadTokens = u.cacheReadTokens

        const gpu = pickGpuTimings(body)
        if (gpu.gpuPrefillMs != null) this.gpu.gpuPrefillMs = gpu.gpuPrefillMs
        if (gpu.gpuDecodeMs != null) this.gpu.gpuDecodeMs = gpu.gpuDecodeMs

        const kind = tokenKind(body)
        if (kind === 'reasoning') {
          if (this.reasoningStartAtMs == null) this.reasoningStartAtMs = at
        } else if (kind === 'content') {
          if (this.firstContentAtMs == null) this.firstContentAtMs = at
        }

        if (body.type === 'message_stop' && this.doneAtMs == null) {
          this.doneAtMs = at
        }
      } catch {
        // ignore malformed chunks
      }
    }
  }
}
