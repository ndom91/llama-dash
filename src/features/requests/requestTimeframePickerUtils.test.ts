import { execFileSync } from 'node:child_process'
import { expect, it } from 'vitest'
import {
  draftBounds,
  formatPickerDay,
  formatRangeDuration,
  formatResolvedWindow,
  parsePickerDay,
  validateRangeDraft,
} from './requestTimeframePickerUtils'

const now = new Date(2026, 10, 16, 20, 20).getTime()
const draft = { fromDay: 'Nov 14, 2026', fromTime: '17:20', toDay: 'Nov 16, 2026', toTime: '20:20' }
it('validates the local draft without normalizing invalid dates or clock input', () => {
  expect(formatPickerDay(parsePickerDay(draft.fromDay)!)).toBe(draft.fromDay)
  expect(parsePickerDay('Feb 30, 2026')).toBeUndefined()
  expect(parsePickerDay('Foo 1, 2026')).toBeUndefined()
  expect(validateRangeDraft(draft, now)).toBeNull()
  expect(validateRangeDraft({ ...draft, fromTime: '25:00' }, now)).toContain('valid dates')
  expect(validateRangeDraft({ ...draft, fromDay: 'Nov 17, 2026' }, now)).toContain('later than start')
  expect(validateRangeDraft({ ...draft, toTime: '21:00' }, now)).toContain('at or before now')
  expect(validateRangeDraft(draft, now, new Date(2026, 10, 15).getTime())).toContain('retained history')
  expect(validateRangeDraft(draft, now, new Date(2026, 10, 14, 18).getTime())).toBeNull()
  expect(validateRangeDraft(draft, now, null)).toContain('retained history')
})

it('formats the trigger window and duration at the mockup thresholds', () => {
  expect(formatResolvedWindow({ timeframe: '3h' }, now)).toBe('17:20 → 20:20')
  const { from, to } = draftBounds(draft)
  expect(formatResolvedWindow({ timeframe: 'custom', from: from!, to: to! }, now)).toBe('Nov 14 17:20 → Nov 16 20:20')
  expect(formatResolvedWindow({ timeframe: '30d' }, now)).toBe('Oct 17 → Nov 16')
  expect(formatRangeDuration(from!, to!)).toBe('2d 3h')
  expect(formatResolvedWindow({ timeframe: 'all' }, now, null)).toBe('')
})

it('resolves calendar days in the browser zone across both DST changes', () => {
  // An isolated Node process makes the time zone deterministic even in threaded test workers.
  const output = execFileSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `
    import { requestTimeBounds, requestApiTimeFilter, parseLocalDateTime } from './src/lib/request-timeframe.ts';
    const day = (year, month, day) => requestTimeBounds({ timeframe: 'yesterday' }, new Date(year, month, day, 12).getTime());
    const spring = day(2026, 2, 30), autumn = day(2026, 9, 26);
    console.log(JSON.stringify({
      lengths: [(spring.to - spring.from) / 3600000, (autumn.to - autumn.from) / 3600000],
      gap: parseLocalDateTime('2026-03-29T02:30'),
      repeated: parseLocalDateTime('2026-10-25T02:30'),
      api: requestApiTimeFilter({ timeframe: 'yesterday' }, new Date(2026, 9, 26, 12).getTime())
    }));
  `,
    ],
    { env: { ...process.env, TZ: 'Europe/Berlin' }, encoding: 'utf8' },
  )
  const result = JSON.parse(output)
  expect(result.lengths).toEqual([23, 25])
  expect(result.gap).toBeNull()
  expect(result.repeated).toBe(Date.parse('2026-10-25T00:30:00Z'))
  expect(result.api).toEqual({
    timeframe: 'custom',
    from: Date.parse('2026-10-24T22:00:00Z'),
    to: Date.parse('2026-10-25T23:00:00Z'),
  })
})
