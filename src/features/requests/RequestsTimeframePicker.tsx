import { Popover } from '@base-ui/react/popover'
import { CalendarClock, Check, ChevronDown } from 'lucide-react'
import { Fragment, useId, useState } from 'react'
import { cn } from '../../lib/cn'
import { DateTimePicker } from '../../components/DateTimePicker'
import {
  localDateTime,
  parseLocalDateTime,
  REQUEST_TIMEFRAMES,
  DEFAULT_REQUEST_TIMEFRAME,
  type RequestTimeFilter,
} from '../../lib/request-timeframe'

type Props = { value: RequestTimeFilter; onChange: (value: RequestTimeFilter) => void }

export function RequestsTimeframePicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const [custom, setCustom] = useState(false)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [error, setError] = useState<string | null>(null)
  const id = useId()
  const selected = custom ? 'custom' : (value.timeframe ?? DEFAULT_REQUEST_TIMEFRAME)
  const label = REQUEST_TIMEFRAMES.find((p) => p.value === (value.timeframe ?? DEFAULT_REQUEST_TIMEFRAME))!.label
  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        if (next) {
          setCustom(value.timeframe === 'custom')
          setFrom(localDateTime(value.from ?? Date.now() - 10_800_000))
          setTo(localDateTime(value.to ?? Date.now()))
          setError(null)
        }
        setOpen(next)
      }}
    >
      <Popover.Trigger
        data-request-timeframe
        className="btn h-8 gap-2 font-mono text-xs data-[popup-open]:border-accent"
        aria-label={`Timeframe: ${label}`}
      >
        <CalendarClock size={14} aria-hidden="true" />
        <span>{label}</span>
        <ChevronDown size={12} aria-hidden="true" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="end" sideOffset={6} className="z-50">
          <Popover.Popup
            data-request-timeframe
            className={cn(
              'max-w-[var(--available-width)] max-h-[var(--available-height)] overflow-y-auto rounded border border-border-strong bg-surface-2 p-1 font-mono text-xs text-fg shadow-lg outline-none',
              custom ? 'w-80' : 'w-60',
            )}
          >
            <Popover.Title className="sr-only">Timeframe</Popover.Title>
            <div className="flex flex-col">
              {REQUEST_TIMEFRAMES.map((preset) => (
                <Fragment key={preset.value}>
                  {preset.value === 'all' ? <hr className="my-1 border-0 border-t border-border" /> : null}
                  <button
                    type="button"
                    aria-pressed={selected === preset.value}
                    className={cn(
                      'flex min-h-9 cursor-pointer items-center justify-between gap-3 rounded-sm px-2.5 text-left text-fg-muted hover:bg-surface-3 hover:text-fg focus-visible:outline-2 focus-visible:outline-accent focus-visible:-outline-offset-2',
                      selected === preset.value && 'bg-surface-3 text-fg',
                    )}
                    onClick={() => {
                      if (preset.value === 'custom') {
                        setCustom(true)
                        return
                      }
                      onChange({ timeframe: preset.value, from: undefined, to: undefined })
                      setOpen(false)
                    }}
                  >
                    <span>{preset.label}</span>
                    <span className="flex size-3 shrink-0 items-center justify-center" aria-hidden="true">
                      {selected === preset.value ? <Check size={12} strokeWidth={2.5} className="text-accent" /> : null}
                    </span>
                  </button>
                </Fragment>
              ))}
            </div>
            {custom ? (
              <form
                className="mt-1 flex flex-col gap-3 border-t border-border p-2.5 pt-3"
                aria-label="Custom time range"
                onSubmit={(event) => {
                  event.preventDefault()
                  const start = parseLocalDateTime(from)
                  const end = parseLocalDateTime(to)
                  if (start === null || end === null) {
                    setError('Enter valid local times. Times skipped by a clock change are unavailable.')
                    return
                  }
                  if (start >= end) {
                    setError('End must be later than start.')
                    return
                  }
                  onChange({ timeframe: 'custom', from: start, to: end })
                  setOpen(false)
                }}
              >
                <p className="text-xs text-fg-muted">
                  {Intl.DateTimeFormat().resolvedOptions().timeZone}. Repeated times during clock changes use the first
                  occurrence. End time is exclusive.
                </p>
                <DateTimePicker
                  label="Start"
                  value={from}
                  describedBy={error ? `${id}-error` : undefined}
                  invalid={!!error}
                  onChange={(next) => {
                    setFrom(next)
                    setError(null)
                  }}
                />
                <DateTimePicker
                  label="End"
                  value={to}
                  describedBy={error ? `${id}-error` : undefined}
                  invalid={!!error}
                  onChange={(next) => {
                    setTo(next)
                    setError(null)
                  }}
                />
                {error ? (
                  <p id={`${id}-error`} role="alert" className="text-xs text-err">
                    {error}
                  </p>
                ) : null}
                <button type="submit" className="btn self-end">
                  Apply range
                </button>
              </form>
            ) : null}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}
