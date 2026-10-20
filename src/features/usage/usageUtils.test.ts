import { describe, expect, it } from 'vitest'
import {
  formatAxisTokens,
  formatShare,
  formatTokens,
  formatUsageDay,
  niceScale,
  parseUsagePeriod,
  usageChartBars,
  usageDelta,
} from './usageUtils'

describe('usageDelta', () => {
  it('reports direction and rounded percent', () => {
    expect(usageDelta(150, 100)).toEqual({ kind: 'change', percent: 50, direction: 'up' })
    expect(usageDelta(25, 100)).toEqual({ kind: 'change', percent: 75, direction: 'down' })
    expect(usageDelta(1001, 1000)).toEqual({ kind: 'change', percent: 0, direction: 'flat' })
  })

  it('distinguishes a new period from an empty one', () => {
    expect(usageDelta(10, 0)).toEqual({ kind: 'new' })
    expect(usageDelta(0, 0)).toEqual({ kind: 'none' })
  })
})

describe('usage formatting', () => {
  it('formats token counts', () => {
    expect(formatTokens(9_999)).toBe('9,999')
    expect(formatTokens(12_400)).toBe('12.4k')
    expect(formatTokens(3_140_000)).toBe('3.1m')
  })

  it('formats shares', () => {
    expect(formatShare(1, 3)).toBe('33%')
    expect(formatShare(1, 1000)).toBe('<1%')
    expect(formatShare(0, 0)).toBe('0%')
  })

  it('formats UTC days independent of the local timezone', () => {
    expect(formatUsageDay('2026-03-10')).toBe('Mar 10')
  })

  it('parses supported periods only', () => {
    expect(parseUsagePeriod('30')).toBe(30)
    expect(parseUsagePeriod(90)).toBe(90)
    expect(parseUsagePeriod('14')).toBeUndefined()
  })
})

describe('usageChartBars', () => {
  const daily = [
    { day: '2026-03-09', requests: 1, promptTokens: 900, completionTokens: 100 },
    { day: '2026-03-10', requests: 1, promptTokens: 0, completionTokens: 50 },
  ]

  it('stacks prompt on generated scaled to the largest daily total', () => {
    expect(usageChartBars(daily, 'all')).toEqual({
      scale: { max: 1000, step: 200, ticks: [0, 200, 400, 600, 800, 1000] },
      bars: [
        { day: '2026-03-09', generated: 0.1, prompt: 0.9 },
        { day: '2026-03-10', generated: 0.05, prompt: 0 },
      ],
    })
  })

  it('drops prompt tokens and rescales to generated only', () => {
    expect(usageChartBars(daily, 'generated')).toEqual({
      scale: { max: 100, step: 20, ticks: [0, 20, 40, 60, 80, 100] },
      bars: [
        { day: '2026-03-09', generated: 1, prompt: 0 },
        { day: '2026-03-10', generated: 0.5, prompt: 0 },
      ],
    })
  })

  it('scales bars against the rounded axis max', () => {
    const { scale, bars } = usageChartBars(
      [{ day: '2026-03-10', requests: 1, promptTokens: 0, completionTokens: 297_600 }],
      'generated',
    )
    expect(scale.max).toBe(300_000)
    expect(bars[0].generated).toBeCloseTo(0.992)
  })

  it('handles an empty or all-zero series', () => {
    expect(usageChartBars([], 'all')).toEqual({ scale: niceScale(0), bars: [] })
    expect(
      usageChartBars([{ day: '2026-03-10', requests: 0, promptTokens: 0, completionTokens: 0 }], 'generated').bars,
    ).toEqual([{ day: '2026-03-10', generated: 0, prompt: 0 }])
  })
})

describe('niceScale', () => {
  it('rounds the axis up to a whole multiple of a 1/2/2.5/5 step', () => {
    expect(niceScale(297_600)).toEqual({ max: 300_000, step: 100_000, ticks: [0, 100_000, 200_000, 300_000] })
    expect(niceScale(7_600_000)).toEqual({
      max: 8_000_000,
      step: 2_000_000,
      ticks: [0, 2_000_000, 4_000_000, 6_000_000, 8_000_000],
    })
    expect(niceScale(12)).toEqual({ max: 15, step: 5, ticks: [0, 5, 10, 15] })
    expect(niceScale(1_100)).toEqual({ max: 1_250, step: 250, ticks: [0, 250, 500, 750, 1_000, 1_250] })
  })

  it('keeps an exact multiple as the max', () => {
    expect(niceScale(300_000).max).toBe(300_000)
    expect(niceScale(100).ticks).toEqual([0, 20, 40, 60, 80, 100])
  })

  it('always yields 3 to 5 intervals for ordinary values', () => {
    for (const max of [5, 7, 13, 99, 101, 999, 1_001, 4_321, 55_555, 123_456_789]) {
      const scale = niceScale(max)
      const intervals = scale.ticks.length - 1
      expect(scale.max).toBeGreaterThanOrEqual(max)
      expect(intervals).toBeGreaterThanOrEqual(3)
      expect(intervals).toBeLessThanOrEqual(5)
    }
  })

  it('uses whole-token steps and a small axis for tiny or empty data', () => {
    expect(niceScale(0)).toEqual({ max: 4, step: 1, ticks: [0, 1, 2, 3, 4] })
    expect(niceScale(-3)).toEqual(niceScale(0))
    expect(niceScale(1)).toEqual({ max: 4, step: 1, ticks: [0, 1, 2, 3, 4] })
    expect(niceScale(3)).toEqual({ max: 4, step: 1, ticks: [0, 1, 2, 3, 4] })
  })
})

describe('formatAxisTokens', () => {
  it('formats compactly without needless decimals', () => {
    expect(formatAxisTokens(0)).toBe('0')
    expect(formatAxisTokens(15)).toBe('15')
    expect(formatAxisTokens(250_000)).toBe('250k')
    expect(formatAxisTokens(1_500_000)).toBe('1.5m')
    expect(formatAxisTokens(2_000_000)).toBe('2m')
    expect(formatAxisTokens(2_500)).toBe('2.5k')
    expect(formatAxisTokens(12_500)).toBe('12.5k')
    expect(formatAxisTokens(3_000_000_000)).toBe('3b')
  })
})
