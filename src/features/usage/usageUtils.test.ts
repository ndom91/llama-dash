import { describe, expect, it } from 'vitest'
import { formatShare, formatTokens, formatUsageDay, parseUsagePeriod, usageDelta } from './usageUtils'

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
