import { type TouchEvent, useRef } from 'react'

const EDGE_GUARD_PX = 24
const MIN_DISTANCE_PX = 80
const MAX_DURATION_MS = 900
const INTERACTIVE =
  'a, button, input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="slider"]'

type Start = { x: number; y: number; time: number }

function startsInHorizontalScroller(target: Element, boundary: Element): boolean {
  for (let element: Element | null = target; element && element !== boundary; element = element.parentElement) {
    if (element.scrollWidth > element.clientWidth + 1 && /^(auto|scroll)$/.test(getComputedStyle(element).overflowX)) {
      return true
    }
  }
  return false
}

/** A deliberate horizontal swipe moves through requests without intercepting native scrolling. */
export function useRequestSwipe(onNavigate: (direction: 'newer' | 'older') => void, enabled: boolean) {
  const start = useRef<Start | null>(null)

  function onTouchStart(event: TouchEvent<HTMLElement>) {
    start.current = null
    if (!enabled || window.innerWidth > 767 || event.touches.length !== 1) return
    const touch = event.touches[0]
    if (touch.clientX < EDGE_GUARD_PX || touch.clientX > window.innerWidth - EDGE_GUARD_PX) return
    const target = event.target instanceof Element ? event.target : null
    if (!target || target.closest(INTERACTIVE) || startsInHorizontalScroller(target, event.currentTarget)) return
    start.current = { x: touch.clientX, y: touch.clientY, time: Date.now() }
  }

  function onTouchEnd(event: TouchEvent<HTMLElement>) {
    const initial = start.current
    start.current = null
    if (!enabled || !initial || event.touches.length !== 0 || event.changedTouches.length !== 1) return
    if (Date.now() - initial.time > MAX_DURATION_MS || window.getSelection()?.isCollapsed === false) return
    const touch = event.changedTouches[0]
    const dx = touch.clientX - initial.x
    const dy = touch.clientY - initial.y
    if (Math.abs(dx) < MIN_DISTANCE_PX || Math.abs(dx) < Math.abs(dy) * 1.5) return
    onNavigate(dx > 0 ? 'newer' : 'older')
  }

  return {
    onTouchStart,
    onTouchEnd,
    onTouchCancel: () => {
      start.current = null
    },
  }
}
