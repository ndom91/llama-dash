import type { ReactNode } from 'react'
import { cn } from '../lib/cn'

type Props = {
  /** Shows `active` when true, `idle` otherwise. */
  on: boolean
  idle: ReactNode
  active: ReactNode
}

/**
 * Cross-fades a button label in place. Both labels share one grid cell, so the button keeps the
 * width of the wider label and does not jump. The hidden label is removed from the accessible name.
 */
export function TextSwap({ on, idle, active }: Props) {
  return (
    <span className={cn('copy-text-swap', on && 'copy-text-swap-done')}>
      <span className="copy-text-swap-from" aria-hidden={on}>
        {idle}
      </span>
      <span className="copy-text-swap-to" aria-hidden={!on}>
        {active}
      </span>
    </span>
  )
}
