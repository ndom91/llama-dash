/**
 * Display timing model (labels always shown; 0/null → "—"):
 *   queue + model loading + prefill + reasoning + response + other = total
 *
 * - prefill = llama.cpp timings.prompt_ms
 * - model loading = (RELAY → REASON|RESPOND wall) − prefill
 *   Unavailable when neither REASON nor RESPOND exists.
 * - reasoning = wall REASON → RESPOND (null unless both exist)
 * - response = timings.predicted_ms − reasoning (or predicted_ms if no reasoning)
 * - other = remainder so the sum equals total
 */

export type DisplayPhases = {
  modelLoadingMs: number | null
  prefillMs: number | null
  reasoningMs: number | null
  responseMs: number | null
}

export type DisplayTimingInput = {
  queueMs?: number | null
  modelLoadingMs?: number | null
  prefillMs?: number | null
  reasoningMs?: number | null
  responseMs?: number | null
}

export type TimingPhaseTone = 'queue' | 'load' | 'prefill' | 'reasoning' | 'response' | 'other'

export type TimingPhase = {
  key: string
  label: string
  ms: number
  tone: TimingPhaseTone
}

export const TIMING_PHASE_TONE_CLASS: Record<TimingPhaseTone, string> = {
  queue: 'bg-fg-dim',
  load: 'bg-info',
  prefill: 'bg-warn',
  reasoning: 'bg-accent/70',
  response: 'bg-accent',
  other: 'bg-surface-4',
}

const PHASE_DEFS: Array<{
  key: string
  label: string
  tone: TimingPhaseTone
  pick: (timing: DisplayTimingInput) => number | null | undefined
}> = [
  { key: 'queue', label: 'queue', tone: 'queue', pick: (t) => t.queueMs },
  { key: 'model_loading', label: 'model loading', tone: 'load', pick: (t) => t.modelLoadingMs },
  { key: 'prefill', label: 'prefill', tone: 'prefill', pick: (t) => t.prefillMs },
  { key: 'reasoning', label: 'reasoning', tone: 'reasoning', pick: (t) => t.reasoningMs },
  { key: 'response', label: 'response', tone: 'response', pick: (t) => t.responseMs },
]

/** Build display phases from RELAY→first-token wall + GPU timings + optional reasoning. */
export function deriveDisplayPhases(input: {
  /**
   * Wall ms from RELAY (backend dispatch) → REASON, or RESPOND if no reasoning.
   * Null when neither REASON nor RESPOND fired.
   */
  relayToFirstTokenMs: number | null
  gpuPrefillMs: number | null
  gpuDecodeMs: number | null
  /** Wall REASON→RESPOND; only set when both markers exist. */
  reasoningMs: number | null
}): DisplayPhases {
  const prefillMs = input.gpuPrefillMs
  const modelLoadingMs =
    input.relayToFirstTokenMs != null
      ? Math.max(0, Math.round(input.relayToFirstTokenMs - (input.gpuPrefillMs ?? 0)))
      : null
  const reasoningMs = input.reasoningMs != null && input.reasoningMs > 0 ? Math.round(input.reasoningMs) : null
  const responseMs = input.gpuDecodeMs != null ? Math.max(0, Math.round(input.gpuDecodeMs - (reasoningMs ?? 0))) : null
  return { modelLoadingMs, prefillMs, reasoningMs, responseMs }
}

/** Positive contribution for sum/other math; null/≤0 count as 0. */
export function phaseContributionMs(ms: number | null | undefined): number {
  return ms != null && ms > 0 ? ms : 0
}

/** Sum of known display phases (excludes synthetic `other`). */
export function sumKnownTimingPhases(timing: DisplayTimingInput): number {
  return (
    phaseContributionMs(timing.queueMs) +
    phaseContributionMs(timing.modelLoadingMs) +
    phaseContributionMs(timing.prefillMs) +
    phaseContributionMs(timing.reasoningMs) +
    phaseContributionMs(timing.responseMs)
  )
}

/**
 * Always returns queue → model loading → prefill → reasoning → response → other.
 * Values may be 0. `other` is the remainder so sum === durationMs.
 */
export function buildTimingPhases(durationMs: number, timing: DisplayTimingInput): TimingPhase[] {
  const phases: TimingPhase[] = PHASE_DEFS.map((def) => ({
    key: def.key,
    label: def.label,
    ms: Math.max(0, def.pick(timing) ?? 0),
    tone: def.tone,
  }))

  let accounted = phases.reduce((sum, phase) => sum + phase.ms, 0)
  if (accounted > durationMs && durationMs > 0) {
    let excess = accounted - durationMs
    for (let i = phases.length - 1; i >= 0 && excess > 0; i--) {
      const phase = phases[i]!
      const cut = Math.min(phase.ms, excess)
      phase.ms -= cut
      excess -= cut
    }
    accounted = phases.reduce((sum, phase) => sum + phase.ms, 0)
  }

  const otherMs = Math.max(0, durationMs - accounted)
  phases.push({ key: 'other', label: 'other', ms: otherMs, tone: 'other' })
  return phases
}
