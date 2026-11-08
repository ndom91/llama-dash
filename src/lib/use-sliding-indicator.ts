import { useEffect, useRef, useState } from 'react'

export function useSlidingIndicator<T extends string | number, C extends HTMLElement>(
  value: T,
  optionKey: string,
  enabled = true,
) {
  const containerRef = useRef<C>(null)
  const indicatorRef = useRef<HTMLSpanElement>(null)
  const itemRefs = useRef(new Map<T, HTMLButtonElement>())
  const positioned = useRef(false)
  const [ready, setReady] = useState(false)

  // biome-ignore lint/correctness/useExhaustiveDependencies: optionKey tracks changes to the items
  useEffect(() => {
    const container = containerRef.current
    const indicator = indicatorRef.current
    const active = itemRefs.current.get(value)
    if (!enabled || !container || !indicator || !active) return

    const position = (animate: boolean) => {
      if (!animate) indicator.style.transition = 'none'
      indicator.style.transform = `translateX(${active.offsetLeft}px)`
      indicator.style.width = `${active.offsetWidth}px`
      if (!animate) {
        void indicator.offsetWidth
        indicator.style.removeProperty('transition')
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
    observer.observe(container)
    for (const item of itemRefs.current.values()) observer.observe(item)
    return () => observer.disconnect()
  }, [value, optionKey, enabled])

  return { containerRef, indicatorRef, itemRefs, ready }
}
