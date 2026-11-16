import { Popover } from '@base-ui/react/popover'
import { CalendarClock, ChevronDown } from 'lucide-react'
import { useId, useState } from 'react'
import { cn } from '../../lib/cn'
import {
  localDateTime,
  parseLocalDateTime,
  REQUEST_TIMEFRAMES,
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
  const label = REQUEST_TIMEFRAMES.find((p) => p.value === (value.timeframe ?? 'all'))!.label
  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        if (next) {
          setCustom(value.timeframe === 'custom')
          setFrom(localDateTime(value.from ?? Date.now() - 3_600_000))
          setTo(localDateTime(value.to ?? Date.now()))
          setError(null)
        }
        setOpen(next)
      }}
    >
      <Popover.Trigger
        data-request-timeframe
        className="btn h-8 gap-2 font-mono text-xs"
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
            className="w-80 max-w-[var(--available-width)] max-h-[var(--available-height)] overflow-y-auto rounded border border-border-strong bg-surface-2 p-3 text-fg shadow-lg outline-none"
          >
            <Popover.Title className="mb-2 font-mono text-xs font-medium">Timeframe</Popover.Title>
            <div className="flex flex-col gap-1">
              {REQUEST_TIMEFRAMES.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  aria-pressed={custom ? preset.value === 'custom' : preset.value === (value.timeframe ?? 'all')}
                  className={cn(
                    'rounded px-2 py-2 text-left text-xs hover:bg-surface-3 focus-visible:outline-2 focus-visible:outline-accent',
                    (custom ? preset.value === 'custom' : preset.value === (value.timeframe ?? 'all')) &&
                      'bg-surface-3 font-medium',
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
                  {preset.label}
                </button>
              ))}
            </div>
            {custom ? (
              <form
                className="mt-3 flex flex-col gap-3 border-t border-border pt-3"
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
                <label className="flex flex-col gap-1 text-xs" htmlFor={`${id}-from`}>
                  Start
                  <input
                    id={`${id}-from`}
                    name="from"
                    type="datetime-local"
                    required
                    min="1970-01-01T00:00"
                    value={from}
                    aria-describedby={error ? `${id}-error` : undefined}
                    aria-invalid={error ? true : undefined}
                    onChange={(e) => {
                      setFrom(e.target.value)
                      setError(null)
                    }}
                    className="h-9 min-w-0 rounded border border-border-strong bg-surface-1 px-2 text-fg focus-visible:outline-2 focus-visible:outline-accent"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs" htmlFor={`${id}-to`}>
                  End
                  <input
                    id={`${id}-to`}
                    name="to"
                    type="datetime-local"
                    required
                    min="1970-01-01T00:00"
                    value={to}
                    aria-describedby={error ? `${id}-error` : undefined}
                    aria-invalid={error ? true : undefined}
                    onChange={(e) => {
                      setTo(e.target.value)
                      setError(null)
                    }}
                    className="h-9 min-w-0 rounded border border-border-strong bg-surface-1 px-2 text-fg focus-visible:outline-2 focus-visible:outline-accent"
                  />
                </label>
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
