import * as RTooltip from '@radix-ui/react-tooltip'
import type { ReactNode } from 'react'

/**
 * Single app-wide provider so every tooltip shares the same delay and all
 * tooltips hide when one becomes visible (radix handles this for us).
 */
export function TooltipProvider({ children }: { children: ReactNode }) {
  return <RTooltip.Provider delayDuration={250}>{children}</RTooltip.Provider>
}

type TooltipProps = {
  /** Short label — keep it to a handful of words. */
  label: string
  /** Trigger element. Must be a single child that accepts a ref (e.g. <button>). */
  children: ReactNode
  side?: 'top' | 'right' | 'bottom' | 'left'
  align?: 'start' | 'center' | 'end'
}

export function Tooltip({ label, children, side = 'bottom', align = 'center' }: TooltipProps) {
  return (
    <RTooltip.Root>
      <RTooltip.Trigger asChild>{children}</RTooltip.Trigger>
      <RTooltip.Portal>
        <RTooltip.Content className="llama-tooltip" side={side} align={align} sideOffset={6} collisionPadding={8}>
          {label}
          <RTooltip.Arrow className="llama-tooltip-arrow" width={8} height={4} />
        </RTooltip.Content>
      </RTooltip.Portal>
    </RTooltip.Root>
  )
}
