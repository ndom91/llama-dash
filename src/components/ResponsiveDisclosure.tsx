import { Collapsible } from '@base-ui/react/collapsible'
import { type ReactElement, type ReactNode, useCallback, useState, useSyncExternalStore } from 'react'
import { cn } from '../lib/cn'

type Props = {
  children: ReactNode
  desktopMinWidth: 768 | 901
  className?: string
  render?: ReactElement
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function ResponsiveDisclosure({ children, desktopMinWidth, className, render, open, onOpenChange }: Props) {
  const [localOpen, setLocalOpen] = useState(false)
  const query = `(min-width: ${desktopMinWidth}px)`
  const subscribe = useCallback(
    (notify: () => void) => {
      if (typeof window.matchMedia !== 'function') return () => {}
      const media = window.matchMedia(query)
      media.addEventListener('change', notify)
      return () => media.removeEventListener('change', notify)
    },
    [query],
  )
  const desktop = useSyncExternalStore(
    subscribe,
    () => typeof window.matchMedia === 'function' && window.matchMedia(query).matches,
    () => true,
  )
  const mobileOpen = open ?? localOpen
  return (
    <Collapsible.Root
      render={render}
      className={cn('responsive-disclosure', `responsive-disclosure--${desktopMinWidth}`, className)}
      open={desktop || mobileOpen}
      onOpenChange={(next) => {
        if (desktop) return
        if (onOpenChange) onOpenChange(next)
        else setLocalOpen(next)
      }}
    >
      {children}
    </Collapsible.Root>
  )
}

export const ResponsiveDisclosureTrigger = Collapsible.Trigger

export function ResponsiveDisclosurePanel({
  children,
  className,
  id,
}: {
  children: ReactNode
  className?: string
  id?: string
}) {
  return (
    <Collapsible.Panel id={id} keepMounted className={cn('responsive-disclosure-panel', className)}>
      {children}
    </Collapsible.Panel>
  )
}
