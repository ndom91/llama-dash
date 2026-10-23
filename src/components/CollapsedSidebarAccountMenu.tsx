import Avatar from 'boring-avatars'
import { LogOut } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { authClient } from '../lib/auth-client'
import { cn } from '../lib/cn'
import { useColorTheme } from '../lib/use-color-theme'
import { Tooltip } from './Tooltip'

type Session = ReturnType<typeof authClient.useSession>['data']

export function CollapsedSidebarAccountMenu({ initialSession }: { initialSession?: Session | null }) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const { data: clientSession } = authClient.useSession()
  const session = clientSession ?? initialSession
  const colorTheme = useColorTheme()
  const activeTheme = colorTheme.themes.find((theme) => theme.id === colorTheme.themeId) ?? colorTheme.themes[0]
  const avatarColors = [
    activeTheme.accent['300'],
    activeTheme.accent['500'],
    activeTheme.accent['700'],
    activeTheme.status.info,
    activeTheme.status.warn,
  ]
  const username = session?.user.email ?? session?.user.name ?? 'dashboard user'

  useEffect(() => {
    if (!open) return
    const closeOnOutsidePress = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('pointerdown', closeOnOutsidePress)
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      window.removeEventListener('pointerdown', closeOnOutsidePress)
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  async function signOut() {
    await authClient.signOut()
    window.location.href = '/login'
  }

  return (
    <div ref={containerRef} className="relative hidden shrink-0 md:block">
      <Tooltip label="Account" side="right">
        <button
          type="button"
          className="mx-auto mb-3 flex size-8 items-center justify-center overflow-hidden rounded-full border border-border bg-surface-3 transition-[border-color,box-shadow] duration-150 hover:border-border-strong focus-visible:outline-none focus-visible:shadow-focus"
          aria-label="Account menu"
          aria-expanded={open}
          aria-controls="collapsed-sidebar-account-menu"
          onClick={() => setOpen((value) => !value)}
        >
          <Avatar name={username} variant="marble" size={32} colors={avatarColors} title={false} aria-hidden="true" />
        </button>
      </Tooltip>
      {open ? (
        <div
          id="collapsed-sidebar-account-menu"
          className="fixed bottom-3 left-15 z-[101] w-56 rounded border border-border-strong bg-surface-1 p-1.5 shadow-[0_12px_30px_color-mix(in_srgb,var(--bg-0)_78%,transparent)]"
        >
          <div className="border-b border-border px-2.5 py-2">
            <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-fg-faint">signed in</div>
            <div className="mt-0.5 truncate font-mono text-xs text-fg">{username}</div>
          </div>
          <button
            type="button"
            className={cn(
              'mt-1 flex w-full items-center gap-2 rounded px-2.5 py-2 text-left font-mono text-xs text-fg-muted',
              'transition-[background-color,color] duration-150 hover:bg-surface-3 hover:text-fg focus-visible:outline-none focus-visible:shadow-focus',
            )}
            onClick={signOut}
          >
            <LogOut className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
            Logout
          </button>
        </div>
      ) : null}
    </div>
  )
}
