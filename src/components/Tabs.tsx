import type { ComponentType, ReactNode } from 'react'
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
  return (
    <div
      className={cn('flex overflow-x-auto border-b border-border', variant === 'accent' && 'gap-0', className)}
      role="tablist"
      aria-label={ariaLabel}
    >
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
              equalWidth && 'flex-1',
              variant === 'underline' &&
                'px-4 py-2 text-xs hover:bg-surface-2 hover:text-fg aria-selected:border-accent aria-selected:text-fg aria-[selected=false]:border-transparent aria-[selected=false]:text-fg-muted',
              variant === 'accent' &&
                'relative inline-flex items-center justify-center border-transparent font-semibold uppercase text-fg-dim hover:bg-surface-2 hover:text-fg aria-selected:z-10 aria-selected:mb-px aria-selected:border-accent aria-selected:bg-surface-2 aria-selected:text-accent aria-selected:shadow-[0_2px_0_var(--accent)]',
              variant === 'accent' && density === 'normal' && 'gap-1.5 px-3.5 py-2.5 text-[11px] tracking-[0.08em]',
              variant === 'accent' && density === 'compact' && 'px-3 py-2.5 text-[10px] tracking-[0.1em]',
            )}
            onClick={() => onChange(item.id)}
          >
            {Icon ? <Icon className="icon-12" strokeWidth={2} aria-hidden /> : null}
            {item.label}
          </button>
        )
      })}
    </div>
  )
}
