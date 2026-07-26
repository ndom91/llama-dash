import type { UsageWithClose } from './usage.ts'

/**
 * llama-dash phase timings embedded on assembled non-stream JSON responses
 * (sibling to upstream llama.cpp `timings`, not merged into it).
 *
 * `reason_ms` / `respond_ms` are milliseconds after RELAY (same as SSE `at_ms`).
 * Never wall-clock epoch values.
 */
export type LlamaDashTimings = {
  queued: boolean
  queue_ms: number
  reason_ms: number | null
  respond_ms: number | null
  model_loading_ms: number | null
  prefill_ms: number | null
  reasoning_ms: number | null
  response_ms: number | null
}

export const LLAMA_DASH_TIMINGS_KEY = 'timings_llama_dash' as const

export function buildLlamaDashTimings(input: {
  queueMs: number | null | undefined
  reasonMs: number | null
  respondMs: number | null
  usage: Pick<UsageWithClose, 'modelLoadingMs' | 'prefillMs' | 'reasoningMs' | 'responseMs'>
}): LlamaDashTimings {
  const queueMs = Math.max(0, Math.round(input.queueMs ?? 0))
  return {
    queued: queueMs > 0,
    queue_ms: queueMs,
    reason_ms: input.reasonMs,
    respond_ms: input.respondMs,
    model_loading_ms: input.usage.modelLoadingMs,
    prefill_ms: input.usage.prefillMs,
    reasoning_ms: input.usage.reasoningMs,
    response_ms: input.usage.responseMs,
  }
}

export function attachLlamaDashTimings(
  body: Record<string, unknown>,
  timings: LlamaDashTimings,
): Record<string, unknown> {
  return { ...body, [LLAMA_DASH_TIMINGS_KEY]: timings }
}

export function readLlamaDashTimings(body: unknown): LlamaDashTimings | null {
  if (!body || typeof body !== 'object') return null
  const raw = (body as Record<string, unknown>)[LLAMA_DASH_TIMINGS_KEY]
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
