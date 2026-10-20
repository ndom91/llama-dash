import { describe, expect, it } from 'vitest'
import { formatShare, formatTokens, formatUsageDay, parseUsagePeriod, usageChartBars, usageDelta } from './usageUtils'

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
      peak: 1000,
      bars: [
        { day: '2026-03-09', generated: 0.1, prompt: 0.9 },
        { day: '2026-03-10', generated: 0.05, prompt: 0 },
      ],
    })
  })

  it('drops prompt tokens and rescales to generated only', () => {
    expect(usageChartBars(daily, 'generated')).toEqual({
      peak: 100,
      bars: [
        { day: '2026-03-09', generated: 1, prompt: 0 },
        { day: '2026-03-10', generated: 0.5, prompt: 0 },
      ],
    })
  })

  it('handles an empty or all-zero series', () => {
    expect(usageChartBars([], 'all')).toEqual({ peak: 0, bars: [] })
    expect(
      usageChartBars([{ day: '2026-03-10', requests: 0, promptTokens: 0, completionTokens: 0 }], 'generated'),
    ).toEqual({ peak: 0, bars: [{ day: '2026-03-10', generated: 0, prompt: 0 }] })
  })
})
