import { describe, expect, it } from 'vitest'
import { parseLogTimestamp } from './log-timestamps'

describe('parseLogTimestamp', () => {
  it.each([
    ['2026-11-22T14:17:13+01:00', '2026-11-22T13:17:13.000Z'],
    ['2026-11-22T08:17:13.1-05:00', '2026-11-22T13:17:13.100Z'],
    ['2026-11-22T13:17:13.670123456Z', '2026-11-22T13:17:13.670Z'],
  ])('reads %s at millisecond precision', (prefix, expected) => {
    expect(parseLogTimestamp(`${prefix} [WARN] warning`)).toEqual({
      ts: Date.parse(expected),
      rest: '[WARN] warning',
    })
  })

  it.each([
    '',
    '[INFO] no timestamp',
    '4801.04.670.511 W srv warning',
    '14:17:13 [INFO] no date or timezone',
    '2026-99-22T13:17:13Z [INFO] invalid date',
    '[INFO] timestamp later in message: 2026-11-22T13:17:13Z',
  ])('leaves unknown or invalid timestamps intact: %s', (text) => {
    expect(parseLogTimestamp(text)).toEqual({ ts: null, rest: text })
  })
})
