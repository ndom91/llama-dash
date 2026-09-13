import type { ComponentType, ReactNode } from 'react'
import { useEffect, useRef } from 'react'
import { cn } from '../lib/cn'

type TabIcon = ComponentType<{ className?: string; strokeWidth?: number; 'aria-hidden'?: boolean }>

export type TabItem<T extends string> = {
  id: T
  label: ReactNode
  icon?: TabIcon
}

type TabsProps<T extends string> = {
  items: readonly TabItem<T>[]
  value: T
  onChange: (value: T) => void
  variant?: 'underline' | 'accent'
  density?: 'normal' | 'compact'
  equalWidth?: boolean
  className?: string
  ariaLabel?: string
}

export function Tabs<T extends string>({
  items,
  value,
  onChange,
  variant = 'underline',
  density = 'normal',
  equalWidth = false,
  className,
  ariaLabel,
}: TabsProps<T>) {
  const listRef = useRef<HTMLDivElement>(null)
  const indicatorRef = useRef<HTMLSpanElement>(null)
  const tabRefs = useRef(new Map<T, HTMLButtonElement>())
  const hasPositionedIndicator = useRef(false)

  useEffect(() => {
    if (variant !== 'accent') return

    const list = listRef.current
    const indicator = indicatorRef.current
    const activeTab = tabRefs.current.get(value)
    if (!list || !indicator || !activeTab) return

    const positionIndicator = (animate: boolean) => {
      if (!animate) indicator.style.transition = 'none'
      indicator.style.transform = `translateX(${activeTab.offsetLeft}px)`
      indicator.style.width = `${activeTab.offsetWidth}px`

      if (!animate) {
        void indicator.offsetWidth
        indicator.style.removeProperty('transition')
      }
      indicator.dataset.ready = 'true'
    }

    positionIndicator(hasPositionedIndicator.current)
    hasPositionedIndicator.current = true

    const resizeObserver = new ResizeObserver(() => positionIndicator(false))
    resizeObserver.observe(list)
    return () => resizeObserver.disconnect()
  }, [value, variant])

  return (
    <div
      ref={listRef}
      className={cn('flex overflow-x-auto border-b border-border', variant === 'accent' && 'relative gap-0', className)}
      role="tablist"
      aria-label={ariaLabel}
    >
      {variant === 'accent' ? (
        <span
          ref={indicatorRef}
          className="pointer-events-none absolute top-0.5 bottom-0.5 left-0 z-0 rounded-sm border border-accent/75 bg-accent/15 opacity-0 transition-[transform,width,opacity] duration-[var(--motion-duration-fast)] [transition-timing-function:var(--motion-ease-smooth-out)] data-[ready=true]:opacity-100 motion-reduce:transition-none"
          aria-hidden="true"
        />
      ) : null}
      {items.map((item) => {
        const active = item.id === value
        const Icon = item.icon
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={active}
            className={cn(
              'cursor-pointer border-b-2 bg-transparent font-mono transition-colors focus-visible:outline-none focus-visible:shadow-focus',
              variant === 'accent' && 'relative z-10',
              equalWidth && 'flex-1',
              variant === 'underline' &&
                'px-4 py-2 text-xs hover:bg-surface-2 hover:text-fg aria-selected:border-accent aria-selected:text-fg aria-[selected=false]:border-transparent aria-[selected=false]:text-fg-muted',
              variant === 'accent' &&
                'inline-flex items-center justify-center border-transparent font-semibold uppercase text-fg-dim hover:bg-surface-2 hover:text-fg aria-selected:mb-px aria-selected:border-accent aria-selected:bg-transparent aria-selected:text-accent aria-selected:shadow-[0_2px_0_var(--accent)]',
              variant === 'accent' && density === 'normal' && 'gap-1.5 px-3.5 py-2.5 text-[11px] tracking-[0.08em]',
              variant === 'accent' && density === 'compact' && 'px-3 py-2.5 text-[10px] tracking-[0.1em]',
            )}
            ref={(element) => {
              if (element) tabRefs.current.set(item.id, element)
              else tabRefs.current.delete(item.id)
            }}
            onClick={() => onChange(item.id)}
          >
            {Icon ? <Icon className="size-3 shrink-0" strokeWidth={2} aria-hidden /> : null}
            {item.label}
          </button>
        )
      })}
    </div>
  )
}
