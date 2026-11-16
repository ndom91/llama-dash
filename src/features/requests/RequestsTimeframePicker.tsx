import { Popover } from '@base-ui/react/popover'
import { ChevronDown, Clock3, Info } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { Tooltip } from '../../components/Tooltip'
import {
  localDateTime,
  REQUEST_TIMEFRAMES,
  DEFAULT_REQUEST_TIMEFRAME,
  type RequestTimeFilter,
  type RequestTimeframe,
} from '../../lib/request-timeframe'
import { RequestsRangeCalendar } from './RequestsRangeCalendar'
import { RequestsRangeFields } from './RequestsRangeFields'
import { RequestsTimeframePresets } from './RequestsTimeframePresets'
import {
  draftBounds,
  formatPickerDay,
  formatRangeDuration,
  formatResolvedWindow,
  makeRangeDraft,
  parsePickerDay,
  startOfPickerDay,
  validateRangeDraft,
  type RangeDraft,
} from './requestTimeframePickerUtils'

type Props = {
  value: RequestTimeFilter
  onChange: (value: RequestTimeFilter) => void
  earliestRetainedAt?: number | null
}
const EMPTY_DRAFT: RangeDraft = { fromDay: '', fromTime: '', toDay: '', toTime: '' }

export function RequestsTimeframePicker({ value, onChange, earliestRetainedAt }: Props) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<RequestTimeframe>(value.timeframe ?? DEFAULT_REQUEST_TIMEFRAME)
  const [draft, setDraft] = useState(EMPTY_DRAFT)
  const [hovered, setHovered] = useState<Date>()
  const [now, setNow] = useState<number>()
  const [keyboard, setKeyboard] = useState(false)
  const popup = useRef<HTMLDivElement>(null)
  const focusEnd = useRef(false)
  const id = useId()
  const custom = mode === 'custom'
  const preset = REQUEST_TIMEFRAMES.find((option) => option.value === mode)!
  const label = REQUEST_TIMEFRAMES.find(
    (option) => option.value === (value.timeframe ?? DEFAULT_REQUEST_TIMEFRAME),
  )!.label
  const validation = now === undefined ? null : validateRangeDraft(draft, now, earliestRetainedAt)
  const error = custom && draft.fromDay && draft.toDay ? validation : null
  const bounds = draftBounds(draft)
  const rolling = !!preset.shortcut || mode === 'today'
  const duration = custom
    ? bounds.from !== null && bounds.to !== null && bounds.to > bounds.from
      ? formatRangeDuration(bounds.from, bounds.to)
      : ''
    : preset.shortcut
      ? `rolling ${preset.shortcut}`
      : mode === 'today'
        ? 'today so far'
        : mode === 'yesterday'
          ? 'calendar day'
          : 'all retained'
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone

  useEffect(() => {
    setNow(Date.now())
    const timer = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(timer)
  }, [])
  useEffect(() => {
    if (focusEnd.current && draft.toDay) {
      focusEnd.current = false
      popup.current?.querySelector<HTMLInputElement>('[aria-label="To time"]')?.focus()
    }
  }, [draft.toDay])

  function pickDay(day: Date) {
    const time = Date.now()
    setNow(time)
    const start = custom ? parsePickerDay(draft.fromDay) : undefined
    if (start && !draft.toDay) {
      const [from, to] = [start, day].sort((a, b) => a.getTime() - b.getTime())
      setDraft({
        fromDay: formatPickerDay(from),
        fromTime: draft.fromTime,
        toDay: formatPickerDay(to),
        toTime: startOfPickerDay(to.getTime()) === startOfPickerDay(time) ? localDateTime(time).slice(11) : '23:59',
      })
      focusEnd.current = true
    } else {
      setDraft({ fromDay: formatPickerDay(day), fromTime: '00:00', toDay: '', toTime: '' })
    }
    setMode('custom')
    setHovered(undefined)
    setKeyboard(false)
  }

  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        if (next) {
          const time = Date.now()
          setNow(time)
          setMode(value.timeframe ?? DEFAULT_REQUEST_TIMEFRAME)
          setDraft(makeRangeDraft(value, time, earliestRetainedAt))
          setHovered(undefined)
          setKeyboard(false)
        }
        setOpen(next)
      }}
    >
      <Popover.Trigger
        data-request-timeframe
        aria-label={`Timeframe: ${label}`}
        className="flex h-[30px] max-w-full cursor-pointer items-center border border-border-strong bg-surface-2 font-mono text-[11px] text-fg hover:bg-surface-3 focus-visible:outline-2 focus-visible:outline-accent data-[popup-open]:border-accent"
      >
        <span className="flex items-center gap-2 px-2.5">
          <Clock3 size={12} className="text-fg-dim" aria-hidden="true" />
          {label}
        </span>
        {now !== undefined && formatResolvedWindow(value, now, earliestRetainedAt) ? (
          <span className="border-l border-border px-2.5 text-fg-muted max-[600px]:hidden">
            {formatResolvedWindow(value, now, earliestRetainedAt)}
          </span>
        ) : null}
        <span className="flex h-full w-6 items-center justify-center border-l border-border">
          <ChevronDown size={10} aria-hidden="true" />
        </span>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="end" sideOffset={7} collisionPadding={8} className="z-50">
          <Popover.Popup
            ref={popup}
            data-request-timeframe
            initialFocus={() =>
              popup.current?.querySelector<HTMLButtonElement>(
                `[data-preset="${value.timeframe ?? DEFAULT_REQUEST_TIMEFRAME}"]`,
              ) ?? false
            }
            className="w-[420px] max-w-[var(--available-width)] max-h-[var(--available-height)] overflow-y-auto border border-border-strong bg-surface-1 font-mono text-[11px] text-fg outline-none"
          >
            <Popover.Title className="sr-only">Timeframe</Popover.Title>
            <form
              aria-label="Request timeframe"
              onSubmit={(event) => {
                event.preventDefault()
                if (!custom || validateRangeDraft(draft, Date.now(), earliestRetainedAt)) return
                const { from, to } = draftBounds(draft)
                if (from === null || to === null) return
                onChange({ timeframe: 'custom', from, to })
                setOpen(false)
              }}
            >
              <div className="grid grid-cols-[168px_minmax(0,1fr)] max-[400px]:grid-cols-[136px_minmax(0,1fr)] max-[350px]:grid-cols-[112px_minmax(0,1fr)]">
                <div className="border-r border-border">
                  <RequestsTimeframePresets
                    selected={mode}
                    onKeyboard={setKeyboard}
                    focusCalendar={() =>
                      popup.current
                        ?.querySelector<HTMLElement>(
                          '[role="grid"] button[tabindex="0"], input[aria-label="From date"]',
                        )
                        ?.focus()
                    }
                    onSelect={(timeframe) => {
                      if (timeframe === 'custom') {
                        setMode('custom')
                        return
                      }
                      onChange({ timeframe, from: undefined, to: undefined })
                      setOpen(false)
                    }}
                  />
                </div>
                <div className="min-w-0">
                  {now !== undefined ? (
                    <RequestsRangeCalendar
                      draft={draft}
                      custom={custom}
                      now={now}
                      earliest={earliestRetainedAt}
                      hovered={hovered}
                      onHover={setHovered}
                      onPick={pickDay}
                    />
                  ) : null}
                  <RequestsRangeFields
                    draft={draft}
                    custom={custom}
                    rolling={rolling}
                    errorId={error ? `${id}-error` : undefined}
                    onChange={(next) => {
                      setNow(Date.now())
                      setDraft(next)
                    }}
                  />
                </div>
              </div>
              {error ? (
                <p role="alert" id={`${id}-error`} className="border-t border-border px-3.5 py-2 text-[10px] text-err">
                  {error}
                </p>
              ) : null}
              <div className="flex min-h-11 flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-border px-3.5 py-2 text-[10px]">
                {keyboard ? (
                  <span className="text-[9px] text-fg-dim">↑↓ move · ↵ apply · tab calendar</span>
                ) : (
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <Tooltip
                      side="bottom"
                      align="start"
                      label={
                        <span className="block max-w-56 font-mono text-[10px] leading-relaxed">
                          Times are in {zone}. The end time is exclusive. During the DST fall-back hour, the first
                          occurrence is used. Times skipped by a clock change are unavailable.
                        </span>
                      }
                    >
                      <button
                        type="button"
                        aria-label={`Time zone: ${zone}`}
                        className="flex cursor-help items-center gap-1 text-fg-dim hover:text-fg focus-visible:outline-1 focus-visible:outline-accent"
                      >
                        {zone}
                        <Info size={10} aria-hidden="true" />
                      </button>
                    </Tooltip>
                    {duration ? (
                      <span className="text-fg-muted">
                        <span aria-hidden="true" className="mr-2 text-fg-dim">
                          ·
                        </span>
                        {duration}
                      </span>
                    ) : null}
                  </div>
                )}
                <div className="ml-auto flex items-center gap-4">
                  {custom ? (
                    <>
                      <button
                        type="button"
                        className="cursor-pointer text-fg-muted hover:text-fg focus-visible:outline-1 focus-visible:outline-accent"
                        onClick={() => setOpen(false)}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={!!validation}
                        className="h-[26px] cursor-pointer rounded-[2px] bg-accent px-3 text-accent-on hover:bg-accent-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-default disabled:bg-surface-3 disabled:text-fg-dim"
                      >
                        Apply
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setOpen(false)}
                      className="cursor-pointer text-fg-muted hover:text-fg focus-visible:outline-1 focus-visible:outline-accent"
                      aria-label="Close timeframe picker"
                    >
                      Esc
                    </button>
                  )}
                </div>
              </div>
            </form>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}
