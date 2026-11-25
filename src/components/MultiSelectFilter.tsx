import { Popover } from '@base-ui/react/popover'
import { ChevronDown, Search } from 'lucide-react'
import { type KeyboardEvent, type MouseEvent, useId, useMemo, useRef, useState } from 'react'
import { cn } from '../lib/cn'
import { formatCompactNumber } from '../lib/format'
import { type SetFilter, setFilterFromChecked, setFilterIncludes } from '../lib/request-filters'
import { CheckMark } from './Checkbox'
import { type MultiSelectFilterOption, summarizeSetFilter } from './multi-select-filter-summary'

export type { MultiSelectFilterOption } from './multi-select-filter-summary'

type Props = {
  'aria-label': string
  /** Plural noun for labels: "keys" gives "All keys", "No keys", "6 of 11 keys". */
  noun: string
  allLabel?: string
  options: readonly MultiSelectFilterOption[]
  /** Request counts per option value; options without a count show none. */
  counts?: Readonly<Record<string, number>>
  value: SetFilter
  onChange: (value: SetFilter) => void
}

const linkClass =
  'cursor-pointer bg-transparent p-0 text-accent hover:underline disabled:cursor-default disabled:text-fg-faint disabled:no-underline disabled:opacity-50'

/**
 * Multi-select filter where every option starts checked. Changes apply live; `all` / `none` act on
 * the visible matches while searching. Keys on the list: Space toggles, `o` or ⌥+click selects
 * only that row, `a` / `n` select all / none.
 */
export function MultiSelectFilter({ noun, allLabel, options, counts, value, onChange, ...props }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const id = useId()

  const values = useMemo(() => options.map((o) => o.value), [options])
  const checked = useMemo(() => new Set(values.filter((v) => setFilterIncludes(value, v))), [values, value])
  const needle = query.trim().toLowerCase()
  const visible = useMemo(
    () => (needle ? options.filter((o) => o.label.toLowerCase().includes(needle)) : options),
    [options, needle],
  )
  const summary = summarizeSetFilter(options, value, noun, allLabel)
  const allVisibleChecked = visible.every((o) => checked.has(o.value))
  const noneVisibleChecked = visible.every((o) => !checked.has(o.value))

  const apply = (next: Set<string>) => onChange(setFilterFromChecked(values, next))
  const toggle = (v: string) => {
    const next = new Set(checked)
    if (next.has(v)) next.delete(v)
    else next.add(v)
    apply(next)
  }
  const only = (v: string) => apply(new Set([v]))
  const setVisible = (on: boolean) => {
    const next = new Set(checked)
    for (const o of visible) {
      if (on) next.add(o.value)
      else next.delete(o.value)
    }
    apply(next)
  }

  const moveActive = (index: number) => {
    const clamped = Math.max(0, Math.min(visible.length - 1, index))
    setActive(clamped)
    listRef.current?.querySelector(`[data-index="${clamped}"]`)?.scrollIntoView({ block: 'nearest' })
  }

  const onListKeyDown = (e: KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey) return
    const current = visible[active]
    switch (e.key) {
      case 'ArrowDown':
        moveActive(active + 1)
        break
      case 'ArrowUp':
        if (active === 0) inputRef.current?.focus()
        else moveActive(active - 1)
        break
      case 'Home':
        moveActive(0)
        break
      case 'End':
        moveActive(visible.length - 1)
        break
      case ' ':
      case 'Enter':
        if (current) toggle(current.value)
        break
      case 'o':
        if (current) only(current.value)
        break
      case 'a':
        setVisible(true)
        break
      case 'n':
        setVisible(false)
        break
      default:
        return
    }
    e.preventDefault()
  }

  const onRowClick = (e: MouseEvent, v: string, index: number) => {
    setActive(index)
    if (e.altKey) only(v)
    else toggle(v)
  }

  return (
    <Popover.Root
      open={open}
      onOpenChange={(next, details) => {
        // Esc clears an active search first, then closes on the next press.
        if (!next && details.reason === 'escape-key' && query) {
          setQuery('')
          setActive(0)
          return
        }
        if (!next) {
          setQuery('')
          setActive(0)
        }
        setOpen(next)
      }}
    >
      <Popover.Trigger
        aria-label={`${props['aria-label']}: ${summary.label}`}
        className={cn(
          'flex h-8 w-full cursor-pointer items-center gap-2 rounded border px-2.5 text-left font-mono text-xs outline-none transition-[border-color,box-shadow,background-color] duration-100 hover:border-fg-faint focus-visible:border-accent focus-visible:[box-shadow:var(--shadow-focus)] data-[popup-open]:border-accent',
          summary.tone === 'idle'
            ? 'border-border-strong bg-surface-2 text-fg-dim'
            : 'border-border-strong bg-surface-3 text-fg',
        )}
      >
        <span className="min-w-0 flex-1 truncate">{summary.label}</span>
        {summary.badge ? (
          <span
            className={cn(
              'shrink-0 rounded-sm px-1 text-[10px] tabular-nums leading-4',
              summary.tone === 'empty' ? 'bg-warn-bg text-warn' : 'bg-surface-1 text-fg-muted',
            )}
          >
            {summary.badge}
          </span>
        ) : null}
        <ChevronDown size={12} strokeWidth={2} className="shrink-0 text-fg-dim" aria-hidden="true" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="start" sideOffset={4} collisionPadding={8} className="z-50">
          <Popover.Popup
            initialFocus={inputRef}
            className="flex w-[max(var(--anchor-width),260px)] max-w-[var(--available-width)] flex-col overflow-hidden rounded border border-border-strong bg-surface-2 font-mono text-xs shadow-lg outline-none transition-[opacity,transform] duration-100 ease-out data-[ending-style]:opacity-0 data-[starting-style]:-translate-y-1 data-[starting-style]:opacity-0"
          >
            <Popover.Title className="sr-only">{props['aria-label']} filter</Popover.Title>
            <div className="p-1.5">
              <div className="relative">
                <Search
                  size={12}
                  strokeWidth={2}
                  className="pointer-events-none absolute top-1/2 left-2 -translate-y-1/2 text-fg-dim"
                  aria-hidden="true"
                />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value)
                    setActive(0)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowDown' && visible.length > 0) {
                      e.preventDefault()
                      listRef.current?.focus()
                      moveActive(0)
                    }
                  }}
                  placeholder={`search ${noun}`}
                  aria-label={`Search ${noun}`}
                  aria-controls={`${id}-list`}
                  className="h-7 w-full rounded border border-border bg-surface-1 pr-2 pl-6 font-mono text-xs text-fg outline-none transition-[border-color] duration-100 placeholder:text-fg-faint focus:border-accent"
                />
              </div>
            </div>
            <div className="flex items-center gap-2 border-y border-border px-2.5 py-1 text-[10.5px] text-fg-dim">
              <button type="button" className={linkClass} disabled={allVisibleChecked} onClick={() => setVisible(true)}>
                all
              </button>
              <span aria-hidden="true">·</span>
              <button
                type="button"
                className={linkClass}
                disabled={noneVisibleChecked}
                onClick={() => setVisible(false)}
              >
                none
              </button>
              {needle ? (
                <span className="text-fg-faint">
                  ({visible.length} {visible.length === 1 ? 'match' : 'matches'})
                </span>
              ) : null}
              <span className="ml-auto tabular-nums" aria-live="polite">
                <span className="text-fg">{checked.size}</span> / {options.length} selected
              </span>
            </div>
            <div
              ref={listRef}
              id={`${id}-list`}
              role="listbox"
              aria-multiselectable="true"
              aria-label={props['aria-label']}
              aria-activedescendant={visible[active] ? `${id}-opt-${active}` : undefined}
              tabIndex={0}
              onKeyDown={onListKeyDown}
              className="max-h-[min(320px,calc(var(--available-height)-120px))] overflow-y-auto p-1 outline-none"
            >
              {visible.length === 0 ? (
                <div className="px-2 py-2 text-fg-faint">no matching {noun}</div>
              ) : (
                visible.map((o, index) => {
                  const isChecked = checked.has(o.value)
                  const count = counts?.[o.value]
                  return (
                    // biome-ignore lint/a11y/useKeyWithClickEvents: keyboard input is handled by the listbox (aria-activedescendant).
                    <div
                      key={o.value}
                      id={`${id}-opt-${index}`}
                      data-index={index}
                      role="option"
                      // Focus stays on the listbox; rows are reached via aria-activedescendant.
                      tabIndex={-1}
                      aria-selected={isChecked}
                      onClick={(e) => onRowClick(e, o.value, index)}
                      onMouseMove={() => active !== index && setActive(index)}
                      className={cn(
                        'group flex h-7 cursor-pointer select-none items-center gap-2 rounded-sm px-2 text-fg-muted',
                        index === active && 'bg-surface-3 text-fg',
                        isChecked && 'text-fg',
                      )}
                    >
                      <CheckMark checked={isChecked} />
                      <span className={cn('min-w-0 flex-1 truncate', o.system && 'text-fg-dim italic')}>{o.label}</span>
                      {count !== undefined ? (
                        <span className="shrink-0 text-[10.5px] text-fg-faint tabular-nums group-hover:hidden">
                          {formatCompactNumber(count)}
                        </span>
                      ) : null}
                      <button
                        type="button"
                        tabIndex={-1}
                        className="hidden shrink-0 cursor-pointer bg-transparent p-0 text-[10.5px] text-accent hover:underline group-hover:inline"
                        onClick={(e) => {
                          e.stopPropagation()
                          setActive(index)
                          only(o.value)
                        }}
                      >
                        only
                      </button>
                    </div>
                  )
                })
              )}
            </div>
            {needle ? (
              <div className="flex items-center justify-between border-t border-border px-2.5 py-1 text-[10.5px] text-fg-faint">
                <span>
                  {options.length - visible.length} other {noun} unaffected
                </span>
                <span>esc to clear</span>
              </div>
            ) : null}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}
