import { type ReactNode, useEffect, useRef, useState } from 'react'
import { cn } from '../lib/cn'

type Props<T extends string | number> = {
  legend: string
  options: ReadonlyArray<{ value: T; label: ReactNode }>
  value: T
  onChange: (value: T) => void
  variant?: 'accent' | 'theme' | 'routing' | 'strip'
  fullWidth?: boolean
}

export function SegmentedControl<T extends string | number>({
  legend,
  options,
  value,
  onChange,
  variant = 'accent',
  fullWidth = false,
}: Props<T>) {
  const barRef = useRef<HTMLFieldSetElement>(null)
  const pillRef = useRef<HTMLSpanElement>(null)
  const buttonsRef = useRef(new Map<T, HTMLButtonElement>())
  const positioned = useRef(false)
  const [ready, setReady] = useState(false)
  const optionKey = JSON.stringify(options.map((option) => option.value))

  // biome-ignore lint/correctness/useExhaustiveDependencies: optionKey tracks changes to the option set
  useEffect(() => {
    const bar = barRef.current
    const pill = pillRef.current
    const active = buttonsRef.current.get(value)
    if (!bar || !pill || !active) return

    const position = (animate: boolean) => {
      if (!animate) pill.style.transition = 'none'
      pill.style.transform = `translateX(${active.offsetLeft}px)`
      pill.style.width = `${active.offsetWidth}px`
      if (!animate) {
        void pill.offsetWidth
        pill.style.removeProperty('transition')
      }
    }
    position(positioned.current)
    positioned.current = true
    setReady(true)
    const onResize = () => position(false)
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', onResize)
      return () => window.removeEventListener('resize', onResize)
    }
    const observer = new ResizeObserver(onResize)
    observer.observe(bar)
    for (const button of buttonsRef.current.values()) observer.observe(button)
    return () => observer.disconnect()
  }, [value, optionKey])

  return (
    <fieldset
      ref={barRef}
      className={cn(
        't-tabs segmented-control m-0 flex min-w-0 shrink-0 overflow-hidden rounded border border-border bg-surface-2 p-0.5',
        `segmented-control--${variant}`,
        fullWidth && 'segmented-control--full-width',
      )}
    >
      <legend className="sr-only">{legend}</legend>
      <span ref={pillRef} className="t-tabs-pill segmented-control-pill" data-ready={ready} aria-hidden="true" />
      {options.map((option) => (
        <button
          key={option.value}
          ref={(element) => {
            if (element) buttonsRef.current.set(option.value, element)
            else buttonsRef.current.delete(option.value)
          }}
          type="button"
          className={cn(
            't-tab segmented-control-tab rounded-sm px-2.5 py-1 font-mono text-[11px] tabular-nums',
            value === option.value && !ready ? 'bg-accent text-accent-on' : '',
          )}
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </fieldset>
  )
}
