import {
  localDateTime,
  parseLocalDateTime,
  requestTimeBounds,
  type RequestTimeFilter,
} from '../../lib/request-timeframe'

export type RangeDraft = { fromDay: string; fromTime: string; toDay: string; toTime: string }
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function formatPickerDay(date: Date) {
  return `${MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`
}

export function parsePickerDay(text: string): Date | undefined {
  const match = /^(\w{3}) (\d{1,2}), (\d{4})$/.exec(text)
  if (!match) return undefined
  const month = MONTHS.findIndex((value) => value.toLowerCase() === match[1].toLowerCase())
  const day = Number(match[2])
  const year = Number(match[3])
  const date = new Date(year, month, day, 12)
  return month >= 0 && year >= 1970 && date.getMonth() === month && date.getDate() === day ? date : undefined
}

export function draftBounds(draft: RangeDraft) {
  const parse = (day: string, time: string) => {
    const date = parsePickerDay(day)
    return date ? parseLocalDateTime(`${localDateTime(date.getTime()).slice(0, 10)}T${time}`) : null
  }
  return { from: parse(draft.fromDay, draft.fromTime), to: parse(draft.toDay, draft.toTime) }
}

export function makeRangeDraft(value: RequestTimeFilter, now: number, earliest?: number | null): RangeDraft {
  const bounds = requestTimeBounds(value, now)
  const from = new Date(bounds.from ?? earliest ?? now)
  const to = new Date(bounds.to ?? now)
  return {
    fromDay: formatPickerDay(from),
    fromTime: localDateTime(from.getTime()).slice(11),
    toDay: formatPickerDay(to),
    toTime: localDateTime(to.getTime()).slice(11),
  }
}

export function startOfPickerDay(timestamp: number) {
  const date = new Date(timestamp)
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

export function validateRangeDraft(draft: RangeDraft, now: number, earliest?: number | null) {
  if (!draft.fromDay || !draft.toDay) return 'Select a start and end day.'
  const { from, to } = draftBounds(draft)
  if (from === null || to === null) return 'Enter valid dates and 24-hour times. Clock-change gaps are unavailable.'
  if (from >= to) return 'End must be later than start.'
  if (to > now || from > now) return 'Choose a time at or before now.'
  if (earliest === null || (earliest !== undefined && from < startOfPickerDay(earliest)))
    return 'Choose dates within retained history.'
  return null
}

export function formatRangeDuration(from: number, to: number) {
  const minutes = Math.floor((to - from) / 60_000)
  const days = Math.floor(minutes / 1440)
  const hours = Math.floor((minutes % 1440) / 60)
  return (
    [days ? `${days}d` : '', hours ? `${hours}h` : '', minutes % 60 ? `${minutes % 60}m` : '']
      .filter(Boolean)
      .join(' ') || '<1m'
  )
}

export function formatResolvedWindow(value: RequestTimeFilter, now: number, earliest?: number | null) {
  const { from = earliest, to = now } = requestTimeBounds(value, now)
  if (from == null) return ''
  const start = new Date(from)
  const end = new Date(to)
  const clock = (date: Date) => localDateTime(date.getTime()).slice(11)
  const day = (date: Date) =>
    `${MONTHS[date.getMonth()]} ${date.getDate()}${date.getFullYear() !== end.getFullYear() ? `, ${date.getFullYear()}` : ''}`
  if (startOfPickerDay(from) === startOfPickerDay(to)) return `${clock(start)} → ${clock(end)}`
  if (to - from > 604_800_000) return `${day(start)} → ${day(end)}`
  return `${day(start)} ${clock(start)} → ${day(end)} ${clock(end)}`
}
