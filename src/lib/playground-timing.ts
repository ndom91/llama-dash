import { deriveDisplayPhases, type DisplayPhases } from './timing-phases'

export type PlaygroundEventTimingInput = {
  startedAt: number
  doneAt: number
  closeAt?: number
  relayedAt: number
  reasoningStartAt: number
  firstContentAt: number
  wasQueued: boolean
  /** Already computed (e.g. from RELAY handler); recomputed if null. */
  queueMs: number | null
  promptMs: number | null
  predictedMs: number | null
}

export type PlaygroundEventTiming = DisplayPhases & {
  totalMs: number | undefined
  queueMs: number | null
}

/**
 * Playground inspector timing from the event tape.
 * - duration = START → END
 * - queue = RELAY − START when queued (else 0)
 * - model loading / reasoning use RELAY / REASON / RESPOND clocks
 *   (wire `at_ms` is RELAY-relative; playground adds it to the client RELAY anchor)
 */
export function computePlaygroundEventTiming(input: PlaygroundEventTimingInput): PlaygroundEventTiming {
  const endAt = input.doneAt || input.closeAt || 0
  const totalMs = endAt && input.startedAt ? endAt - input.startedAt : undefined

  const relayAt = input.relayedAt || 0
  const reasonAt = input.reasoningStartAt || 0
  const respondAt = input.firstContentAt || 0
  const firstTokenAt = reasonAt || respondAt || 0
  const relayToFirstTokenMs = relayAt && firstTokenAt ? Math.max(0, firstTokenAt - relayAt) : null
  const reasoningMs = reasonAt && respondAt ? Math.max(0, respondAt - reasonAt) : null

  let queueMs = input.queueMs
  if (queueMs == null) {
    if (input.wasQueued && input.startedAt && input.relayedAt) {
      queueMs = Math.max(0, input.relayedAt - input.startedAt)
    } else if (input.relayedAt) {
      queueMs = 0
    }
  }

  const phases = deriveDisplayPhases({
    relayToFirstTokenMs,
    gpuPrefillMs: input.promptMs,
    gpuDecodeMs: input.predictedMs,
    reasoningMs,
  })

  return {
    totalMs,
    queueMs,
    ...phases,
  }
}
