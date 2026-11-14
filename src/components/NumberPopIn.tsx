import { useState } from 'react'
import { cn } from '../lib/cn'

/**
 * Renders a formatted value and replays a per-digit pop-in whenever it changes. The first render
 * stays still, so data that is already loaded does not animate on page entry.
 */
export function NumberPopIn({ value }: { value: string }) {
  const [initial] = useState(value)
  const [changed, setChanged] = useState(false)
  if (!changed && value !== initial) setChanged(true)

  const chars = [...value]
  return (
    <>
      {/* Split digits read badly in screen readers, so they get the whole value once. */}
      <span className="sr-only">{value}</span>
      {/* Keyed on the value: each change remounts the digits, which restarts the CSS animation. */}
      <span key={value} className={cn('t-digit-group', changed && 'is-animating')} aria-hidden="true">
        {chars.map((char, index) => (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: characters of a static string
            key={index}
            className="t-digit"
            data-stagger={staggerFor(index, chars.length)}
          >
            {char}
          </span>
        ))}
      </span>
    </>
  )
}

// The last two characters trail the rest, so the change reads right to left like a counter.
function staggerFor(index: number, length: number): string | undefined {
  if (index === length - 2) return '1'
  if (index === length - 1) return '2'
  return undefined
}
