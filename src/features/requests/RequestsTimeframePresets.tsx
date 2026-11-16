import { Fragment, useRef, useState } from 'react'
import { cn } from '../../lib/cn'
import { REQUEST_TIMEFRAMES, type RequestTimeframe } from '../../lib/request-timeframe'

type Props = {
  selected: RequestTimeframe
  onSelect: (value: RequestTimeframe) => void
  onKeyboard: (active: boolean) => void
  focusCalendar: () => void
}

export function RequestsTimeframePresets({ selected, onSelect, onKeyboard, focusCalendar }: Props) {
  const [focused, setFocused] = useState(() => REQUEST_TIMEFRAMES.findIndex((preset) => preset.value === selected))
  const buttons = useRef<(HTMLButtonElement | null)[]>([])
  const typed = useRef({ text: '', at: 0 })
  const move = (index: number) => buttons.current[index]?.focus()
  return (
    <fieldset
      aria-label="Timeframe presets"
      className="py-2"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) onKeyboard(false)
      }}
    >
      {REQUEST_TIMEFRAMES.map((preset, index) => (
        <Fragment key={preset.value}>
          {preset.value === 'today' || preset.value === 'all' ? (
            <hr className="my-2 border-0 border-t border-border" />
          ) : null}
          <button
            ref={(element) => {
              buttons.current[index] = element
            }}
            type="button"
            data-preset={preset.value}
            tabIndex={focused === index ? 0 : -1}
            aria-pressed={selected === preset.value}
            className={cn(
              'flex h-7 w-full cursor-pointer items-center justify-between gap-2 whitespace-nowrap px-3.5 text-left text-[11px] text-fg-muted hover:bg-surface-3 hover:text-fg focus-visible:bg-surface-3 focus-visible:text-fg focus-visible:outline-none max-[400px]:px-2 max-[350px]:text-[10px]',
              selected === preset.value && 'bg-surface-3 text-fg shadow-[inset_2px_0_0_var(--accent)]',
            )}
            onPointerDown={() => onKeyboard(false)}
            onFocus={(event) => {
              setFocused(index)
              onKeyboard(event.currentTarget.matches(':focus-visible'))
            }}
            onClick={() => onSelect(preset.value)}
            onKeyDown={(event) => {
              onKeyboard(true)
              if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                event.preventDefault()
                move(
                  (index + (event.key === 'ArrowDown' ? 1 : -1) + REQUEST_TIMEFRAMES.length) %
                    REQUEST_TIMEFRAMES.length,
                )
              } else if (event.key === 'Home' || event.key === 'End') {
                event.preventDefault()
                move(event.key === 'Home' ? 0 : REQUEST_TIMEFRAMES.length - 1)
              } else if (event.key === 'Tab' && !event.shiftKey) {
                event.preventDefault()
                focusCalendar()
              } else if (
                event.key.length === 1 &&
                !event.altKey &&
                !event.ctrlKey &&
                !event.metaKey &&
                event.key !== ' '
              ) {
                event.preventDefault()
                const now = Date.now()
                typed.current = {
                  text: `${now - typed.current.at < 800 ? typed.current.text : ''}${event.key.toLowerCase()}`,
                  at: now,
                }
                const match = REQUEST_TIMEFRAMES.findIndex(
                  (option) =>
                    option.shortcut.startsWith(typed.current.text) ||
                    option.label.toLowerCase().startsWith(typed.current.text),
                )
                if (match >= 0) move(match)
              }
            }}
          >
            <span>{preset.label}</span>
            <span aria-hidden="true" className="text-[9px] text-fg-dim max-[400px]:hidden">
              {preset.shortcut}
            </span>
          </button>
        </Fragment>
      ))}
    </fieldset>
  )
}
