import { useCallback, useState } from 'react'

// Boolean toggle whose state is persisted to localStorage so it survives
// remounts (e.g. navigating between request detail pages keeps the same
// open/closed preference). SSR-safe: falls back to `fallback` when there is
// no window or no stored value.
export function useStickyToggle(key: string, fallback: boolean) {
  const [open, setOpen] = useState<boolean>(() => {
    if (typeof window === 'undefined') return fallback
    const raw = localStorage.getItem(key)
    return raw == null ? fallback : raw === '1'
  })

  const toggle = useCallback(() => {
    setOpen((prev) => {
      const next = !prev
      if (typeof window !== 'undefined') localStorage.setItem(key, next ? '1' : '0')
      return next
    })
  }, [key])

  return [open, toggle] as const
}
