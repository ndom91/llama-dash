import { describe, expect, it } from 'vitest'
import {
  breachedThresholds,
  DEFAULT_SYSTEM_THRESHOLDS,
  parseSystemThresholdsSetting,
} from '../lib/schemas/system-thresholds.ts'
import { footprintFromDelta } from './model-footprints.ts'

describe('system thresholds', () => {
  it('flags readings at or above ceilings and ignores unknown readings', () => {
    const breached = breachedThresholds(
      { gpuTempC: 90, gpuMemPercent: 89.9, ramPercent: null, cpuPercent: 95 },
      DEFAULT_SYSTEM_THRESHOLDS,
    )
    expect([...breached].sort()).toEqual(['cpuPercent', 'gpuTempC'])
  })

  it('treats the queue threshold as an allowed maximum', () => {
    expect(breachedThresholds({ queueDropped: 0 }, DEFAULT_SYSTEM_THRESHOLDS).size).toBe(0)
    expect(breachedThresholds({ queueDropped: 1 }, DEFAULT_SYSTEM_THRESHOLDS).has('queueDropped')).toBe(true)
  })

  it('merges stored partial settings over defaults and rejects invalid JSON', () => {
    expect(parseSystemThresholdsSetting('{"gpuTempC":85}')).toEqual({ ...DEFAULT_SYSTEM_THRESHOLDS, gpuTempC: 85 })
    expect(parseSystemThresholdsSetting('{"gpuTempC":5}')).toEqual(DEFAULT_SYSTEM_THRESHOLDS)
    expect(parseSystemThresholdsSetting('nope')).toEqual(DEFAULT_SYSTEM_THRESHOLDS)
  })
})

describe('model footprint delta', () => {
  it('uses positive growth only', () => {
    expect(footprintFromDelta(1000, 18_900.4)).toBe(17_900)
    expect(footprintFromDelta(5000, 4000)).toBeNull()
    expect(footprintFromDelta(null, 4000)).toBeNull()
  })
})
