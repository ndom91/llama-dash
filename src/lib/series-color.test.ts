import { describe, expect, it } from 'vitest'
import { SERIES_STEPS, assignSeriesSteps, seriesVar } from './series-color'

describe('assignSeriesSteps', () => {
  it('gives every id a step within range', () => {
    const steps = assignSeriesSteps(['a', 'b', 'c'])
    expect(steps.size).toBe(3)
    for (const step of steps.values()) {
      expect(step).toBeGreaterThanOrEqual(0)
      expect(step).toBeLessThan(SERIES_STEPS)
    }
  })

  it('assigns distinct steps to up to SERIES_STEPS concurrent ids', () => {
    const ids = ['gemma-4-12B-fast', 'qwen3.6-35b', 'ornith-1.0-35B', 'kokoro', 'chatterbox-turbo']
    const steps = assignSeriesSteps(ids)
    expect(new Set(steps.values()).size).toBe(ids.length)
  })

  it('is independent of input order', () => {
    const ids = ['gemma-4-12B-fast', 'qwen3.6-35b', 'ornith-1.0-35B']
    const forward = assignSeriesSteps(ids)
    const reversed = assignSeriesSteps([...ids].reverse())
    for (const id of ids) {
      expect(reversed.get(id)).toBe(forward.get(id))
    }
  })

  // The regression this whole module exists to prevent: colors used to be keyed
  // off the active-models array index, so unloading *any* model reshuffled the
  // colors of *every* other model. Now a model on its natural bucket is
  // unaffected by unrelated churn.
  it('keeps non-colliding models on their step when another model unloads', () => {
    const before = assignSeriesSteps(['gemma-4-12B-fast', 'ornith-1.0-35B', 'qwen3.6-35b'])
    const after = assignSeriesSteps(['gemma-4-12B-fast', 'ornith-1.0-35B'])
    expect(after.get('gemma-4-12B-fast')).toBe(before.get('gemma-4-12B-fast'))
    expect(after.get('ornith-1.0-35B')).toBe(before.get('ornith-1.0-35B'))
  })

  // Documenting the known limit of the design rather than pretending it away.
  // 'kokoro' and 'qwen3.6-35b' both hash to bucket 4, so whichever sorts later
  // is probed elsewhere and returns to its natural bucket once the other
  // leaves. Guaranteed distinctness and perfect stability are not
  // simultaneously achievable with a fixed bucket count; distinctness wins.
  it('may move a displaced model back to its natural step when its displacer leaves', () => {
    const together = assignSeriesSteps(['kokoro', 'qwen3.6-35b'])
    const alone = assignSeriesSteps(['qwen3.6-35b'])
    expect(together.get('kokoro')).not.toBe(together.get('qwen3.6-35b'))
    expect(alone.get('qwen3.6-35b')).not.toBe(together.get('qwen3.6-35b'))
  })

  it('is deterministic across calls', () => {
    const ids = ['alpha', 'beta', 'gamma', 'delta']
    expect([...assignSeriesSteps(ids)]).toEqual([...assignSeriesSteps(ids)])
  })

  it('wraps past SERIES_STEPS without collapsing or throwing', () => {
    const ids = Array.from({ length: SERIES_STEPS * 2 + 1 }, (_, i) => `model-${i}`)
    const steps = assignSeriesSteps(ids)
    expect(steps.size).toBe(ids.length)
    for (const step of steps.values()) {
      expect(step).toBeLessThan(SERIES_STEPS)
    }
  })

  it('handles an empty list', () => {
    expect(assignSeriesSteps([]).size).toBe(0)
  })
})

describe('seriesVar', () => {
  it('maps steps to 1-indexed custom properties', () => {
    expect(seriesVar(0)).toBe('var(--series-1)')
    expect(seriesVar(SERIES_STEPS - 1)).toBe(`var(--series-${SERIES_STEPS})`)
  })

  it('wraps out-of-range steps', () => {
    expect(seriesVar(SERIES_STEPS)).toBe('var(--series-1)')
  })
})
