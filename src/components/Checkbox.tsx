import type { CSSProperties, InputHTMLAttributes } from 'react'
import { cn } from '../lib/cn'

// Path length of the tick below, rounded up, so the stroke draw starts fully hidden.
const CHECK_STYLE = { '--check-len': 11 } as CSSProperties

/** Animated tick box. Driven by a preceding `.t-check-input`, `data-checked`, or a `[data-selected]` parent. */
export function CheckMark({ checked }: { checked?: boolean }) {
  return (
    <span className="t-check" data-checked={checked} style={CHECK_STYLE} aria-hidden="true">
      <svg viewBox="0 0 12 12" className="size-2.5" fill="none" aria-hidden="true">
        <path
          d="M2.5 6.25 5 8.75 9.5 3.5"
          stroke="currentColor"
          strokeWidth={1.75}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  )
}

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>

/** Native checkbox with an animated check. The real input stays on top, so clicks, keyboard, and forms work as usual. */
export function Checkbox({ className, ...props }: Props) {
  return (
    <span className="relative inline-flex shrink-0">
      <input
        type="checkbox"
        className={cn('t-check-input absolute inset-0 m-0 cursor-pointer opacity-0 disabled:cursor-default', className)}
        {...props}
      />
      <CheckMark />
    </span>
  )
}
