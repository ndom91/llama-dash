import { DayPicker } from '@daypicker/react'

const navigationButton =
  'absolute top-0 flex size-8 cursor-pointer items-center justify-center rounded text-fg-muted hover:bg-surface-3 hover:text-fg focus-visible:outline-2 focus-visible:outline-accent aria-disabled:pointer-events-none aria-disabled:opacity-30'

export function Calendar({ selected, onSelect }: { selected: Date; onSelect: (date: Date) => void }) {
  return (
    <DayPicker
      mode="single"
      required
      selected={selected}
      onSelect={onSelect}
      defaultMonth={selected}
      startMonth={new Date(1970, 0)}
      autoFocus
      showOutsideDays
      fixedWeeks
      navLayout="around"
      classNames={{
        root: 'font-mono text-xs',
        month: 'relative',
        month_caption: 'mb-2 flex h-8 items-center justify-center px-9 font-medium',
        button_previous: `${navigationButton} left-0`,
        button_next: `${navigationButton} right-0`,
        chevron: 'size-3.5 fill-current',
        month_grid: 'w-full table-fixed border-collapse',
        weekday: 'h-8 text-center text-[10px] font-normal text-fg-dim',
        day: 'p-0.5 text-center',
        day_button:
          'flex aspect-square w-full min-h-8 cursor-pointer items-center justify-center rounded text-fg-muted hover:bg-surface-3 hover:text-fg focus-visible:outline-2 focus-visible:outline-accent focus-visible:-outline-offset-2',
        selected: '[&>button]:bg-accent [&>button]:text-accent-on [&>button]:font-medium',
        today: '[&>button]:underline [&>button]:decoration-accent [&>button]:underline-offset-4',
        outside: '[&>button]:text-fg-dim',
        disabled: 'pointer-events-none opacity-30',
        hidden: 'invisible',
      }}
    />
  )
}
