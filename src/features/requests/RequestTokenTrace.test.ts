import { describe, expect, it } from 'vitest'
import { buildTimingPhases, sumKnownTimingPhases } from './RequestTokenTrace.tsx'
import type { RequestTiming } from './requestDetailUtils.ts'

const empty: RequestTiming = {
  queueMs: null,
  modelLoadingMs: null,
  prefillMs: null,
  reasoningMs: null,
  responseMs: null,
}

describe('buildTimingPhases', () => {
  it('always emits all labels and makes phases sum to duration via other', () => {
    const timing: RequestTiming = {
      queueMs: 100,
      modelLoadingMs: 50,
      prefillMs: 200,
      reasoningMs: 80,
      responseMs: 420,
    }
    const phases = buildTimingPhases(1000, timing)
    expect(phases.map((phase) => phase.key)).toEqual([
      'queue',
      'model_loading',
      'prefill',
      'reasoning',
      'response',
      'other',
    ])
    expect(phases.find((phase) => phase.key === 'other')?.ms).toBe(150)
    expect(phases.reduce((sum, phase) => sum + phase.ms, 0)).toBe(1000)
    expect(sumKnownTimingPhases(timing) + 150).toBe(1000)
  })

  it('includes tiny remainders so phases still add to total', () => {
    const phases = buildTimingPhases(303, {
      queueMs: 100,
      modelLoadingMs: null,
      prefillMs: 100,
      reasoningMs: null,
      responseMs: 100,
    })
    expect(phases.reduce((sum, phase) => sum + phase.ms, 0)).toBe(303)
    expect(phases.find((phase) => phase.key === 'other')?.ms).toBe(3)
  })

  it('puts full duration into other when no known phases exist', () => {
    const phases = buildTimingPhases(800, empty)
    expect(phases.find((phase) => phase.key === 'other')?.ms).toBe(800)
    expect(phases.reduce((sum, phase) => sum + phase.ms, 0)).toBe(800)
  })

  it('keeps zero-valued labels in the list (UI shows —)', () => {
    const phases = buildTimingPhases(300, {
      queueMs: 0,
      modelLoadingMs: 0,
      prefillMs: 120,
      reasoningMs: null,
      responseMs: null,
    })
    expect(phases.map((phase) => phase.key)).toEqual([
      'queue',
      'model_loading',
      'prefill',
      'reasoning',
      'response',
      'other',
    ])
    expect(phases.find((phase) => phase.key === 'queue')?.ms).toBe(0)
    expect(phases.find((phase) => phase.key === 'other')?.ms).toBe(180)
    expect(phases.reduce((sum, phase) => sum + phase.ms, 0)).toBe(300)
  })

  it('trims overshoot so phases never exceed duration', () => {
    const phases = buildTimingPhases(100, {
      queueMs: 40,
      modelLoadingMs: 40,
      prefillMs: 40,
      reasoningMs: 40,
      responseMs: 40,
    })
    expect(phases.reduce((sum, phase) => sum + phase.ms, 0)).toBe(100)
    expect(phases.find((phase) => phase.key === 'other')?.ms).toBe(0)
  })
})
