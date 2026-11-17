import { DayPicker } from '@daypicker/react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { parsePickerDay, startOfPickerDay, type RangeDraft } from './requestTimeframePickerUtils'

type Props = {
  draft: RangeDraft
  custom: boolean
  now: number
  earliest?: number | null
  hovered?: Date
  onHover: (day: Date | undefined) => void
  onPick: (day: Date) => void
}

export function RequestsRangeCalendar({ draft, custom, now, earliest, hovered, onHover, onPick }: Props) {
  const date = (value: string) => {
    const parsed = parsePickerDay(value)
    return parsed ? new Date(startOfPickerDay(parsed.getTime())) : undefined
  }
  const from = custom ? date(draft.fromDay) : new Date(startOfPickerDay(now))
  const to = custom ? date(draft.toDay) : from
  const [month, setMonth] = useState(() => from ?? new Date(now))
  const monthIndex = (date: Date) => date.getFullYear() * 12 + date.getMonth()
  const firstMonth = monthIndex(new Date(earliest ?? 0))
  const lastMonth = monthIndex(new Date(now))
  const preview = from && !to && hovered ? [from.getTime(), hovered.getTime()].sort((a, b) => a - b) : undefined
  return (
    <fieldset
      aria-label="Range calendar"
      className="px-3.5 pt-3 pb-2 max-[350px]:px-2"
      onMouseLeave={() => onHover(undefined)}
    >
      <div className="mb-1 flex h-6 items-center justify-between font-medium">
        <span>{month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
        <div className="flex">
          {([-1, 1] as const).map((direction) => (
            <button
              key={direction}
              type="button"
              aria-label={direction === -1 ? 'Go to the Previous Month' : 'Go to the Next Month'}
              disabled={
                earliest === null ||
                (direction === -1 ? monthIndex(month) <= firstMonth : monthIndex(month) >= lastMonth)
              }
              className="flex size-6 cursor-pointer items-center justify-center text-fg-dim hover:bg-surface-3 hover:text-fg focus-visible:outline-1 focus-visible:outline-accent disabled:cursor-default disabled:opacity-30"
              onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + direction, 1))}
            >
              {direction === -1 ? (
                <ChevronLeft size={10} aria-hidden="true" />
              ) : (
                <ChevronRight size={10} aria-hidden="true" />
              )}
            </button>
          ))}
        </div>
      </div>
      <DayPicker
        mode="range"
        today={new Date(now)}
        selected={{ from, to }}
        // Selection is controlled by the draft; onDayClick implements restart-on-endpoint.
        onSelect={() => {}}
        onDayClick={(day, modifiers) => {
          if (!modifiers.disabled) onPick(day)
        }}
        onDayMouseEnter={(day, modifiers) => onHover(modifiers.disabled ? undefined : day)}
        onDayFocus={(day, modifiers) => onHover(modifiers.disabled ? undefined : day)}
        month={month}
        onMonthChange={setMonth}
        hideNavigation
        disabled={
          earliest === null
            ? () => true
            : [{ after: new Date(now) }, { before: new Date(startOfPickerDay(earliest ?? 0)) }]
        }
        showOutsideDays
        fixedWeeks
        weekStartsOn={1}
        modifiers={{
          endpoint: (day) => day.getTime() === from?.getTime() || day.getTime() === to?.getTime(),
          previewTarget: (day) =>
            !!preview && day.getTime() === hovered?.getTime() && day.getTime() !== from?.getTime(),
          preview: (day) =>
            !!preview &&
            day.getTime() >= preview[0] &&
            day.getTime() <= preview[1] &&
            day.getTime() !== from?.getTime(),
        }}
        modifiersClassNames={{
          preview: 'request-range-preview',
          previewTarget: 'request-range-preview-target',
          endpoint:
            'request-range-endpoint [&>button]:bg-accent [&>button]:hover:bg-accent [&>button]:font-medium [&>button]:text-accent-on',
        }}
        classNames={{
          root: 'relative font-mono text-[11px]',
          month: 'relative',
          month_caption: 'sr-only',
          month_grid: 'w-full table-fixed border-collapse',
          weekday: 'h-6 text-center text-[9px] font-normal text-fg-dim',
          day: 'p-0 text-center',
          day_button:
            'relative flex h-[30px] w-full cursor-pointer items-center justify-center text-fg-muted hover:bg-surface-3 focus-visible:z-10 focus-visible:outline-1 focus-visible:outline-accent focus-visible:-outline-offset-1',
          selected: '',
          range_start: '',
          range_end: '',
          range_middle: 'bg-surface-3 [&>button]:text-fg',
          today:
            '[&>button]:after:absolute [&>button]:after:bottom-1 [&>button]:after:size-0.5 [&>button]:after:bg-current',
          outside: '[&>button]:text-fg-faint',
          disabled: '[&>button]:cursor-default [&>button]:text-fg-faint [&>button]:hover:bg-transparent',
          hidden: 'invisible',
        }}
      />
    </fieldset>
  )
}
