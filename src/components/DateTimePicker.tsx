import { Popover } from '@base-ui/react/popover'
import { CalendarDays, Clock3 } from 'lucide-react'
import { useId, useState } from 'react'
import { localDateTime } from '../lib/request-timeframe'
import { Calendar } from './Calendar'
import { TimeField } from './TimeField'

type Props = {
  label: string
  value: string
  onChange: (value: string) => void
  invalid?: boolean
  describedBy?: string
}

/** Local wall-clock values stay as strings until the form validates the time zone. */
export function DateTimePicker({ label, value, onChange, invalid, describedBy }: Props) {
  const [open, setOpen] = useState(false)
  const id = useId()
  const [datePart, timePart = ''] = value.split('T')
  const [year, month, day] = datePart.split('-').map(Number)
  const selected = new Date(year, month - 1, day, 12)
  const [hours = '', minutes = ''] = timePart.split(':')
  const dateLabel = selected.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
  return (
    <div className="min-w-0 font-mono text-xs">
      <label htmlFor={id} className="mb-1 block text-fg-muted">
        {label}
      </label>
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger
          id={id}
          data-date-time-picker
          aria-label={`${label}: ${dateLabel}, ${hours || '--'}:${minutes || '--'}`}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className="flex min-h-9 w-full cursor-pointer items-center gap-2 rounded border border-border-strong bg-surface-1 px-2.5 text-left text-fg outline-none hover:border-fg-faint focus-visible:border-accent focus-visible:[box-shadow:var(--shadow-focus)] data-[popup-open]:border-accent aria-invalid:border-err"
        >
          <span className="min-w-0 flex-1">{dateLabel}</span>
          <span className="shrink-0 tabular-nums text-fg-muted">
            {hours || '--'}:{minutes || '--'}
          </span>
          <CalendarDays size={14} className="shrink-0 text-fg-dim" aria-hidden="true" />
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner side="bottom" align="start" sideOffset={6} collisionPadding={8} className="z-50">
            <Popover.Popup
              data-date-time-picker
              initialFocus={false}
              className="w-72 max-w-[var(--available-width)] max-h-[var(--available-height)] overflow-y-auto rounded border border-border-strong bg-surface-2 p-3 font-mono text-xs text-fg shadow-lg outline-none"
            >
              <Popover.Title className="sr-only">{label} date and time</Popover.Title>
              <Popover.Description className="sr-only">
                Choose a day with the arrow keys, then set the 24-hour time.
              </Popover.Description>
              <Calendar
                selected={selected}
                onSelect={(date) => onChange(`${localDateTime(date.getTime()).slice(0, 10)}T${timePart}`)}
              />
              <div className="mt-3 flex items-end gap-2 border-t border-border pt-3">
                <Clock3 size={14} className="mb-3 mr-1 shrink-0 text-fg-dim" aria-hidden="true" />
                <TimeField
                  label="Hours"
                  value={hours}
                  max={23}
                  onChange={(next) => onChange(`${datePart}T${next}:${minutes}`)}
                />
                <span className="mb-2.5 text-fg-dim" aria-hidden="true">
                  :
                </span>
                <TimeField
                  label="Minutes"
                  value={minutes}
                  max={59}
                  onChange={(next) => onChange(`${datePart}T${hours}:${next}`)}
                />
                <span className="mb-2.5 ml-auto text-[10px] text-fg-dim">24h</span>
              </div>
              <div className="mt-3 flex items-center justify-between gap-3">
                <span className="text-[10px] text-fg-muted">{Intl.DateTimeFormat().resolvedOptions().timeZone}</span>
                <Popover.Close className="btn btn-xs" type="button">
                  Done
                </Popover.Close>
              </div>
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    </div>
  )
}
