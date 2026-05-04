import { Link } from '@tanstack/react-router'
import Avatar from 'boring-avatars'
import {
  Boxes,
  Fingerprint,
  KeyRound,
  LayoutDashboard,
  Link2,
  LogOut,
  MessageSquare,
  ScrollText,
  ServerCog,
  Settings,
  SlidersHorizontal,
  Shield,
  Terminal,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { authClient } from '../lib/auth-client'
import { cn } from '../lib/cn'
import { useMobileMenu } from '../lib/use-mobile-menu'
import { useGpu, useModels, useRunningModels, useSystemStatus } from '../lib/queries'
import { useColorTheme } from '../lib/use-color-theme'
import { StatusDot, stateTone } from './StatusDot'
import { Logo } from './Logo'
import { Tooltip } from './Tooltip'

type NavItem = {
  to:
    | '/'
    | '/models'
    | '/requests'
    | '/logs'
    | '/system'
    | '/playground'
    | '/config'
    | '/settings'
    | '/keys'
    | '/attribution'
    | '/endpoints'
    | '/policies'
  label: string
  shortcut: string
  Icon: typeof LayoutDashboard
}

type FutureItem = { label: string; shortcut: string; Icon: typeof LayoutDashboard }

type NavSection = {
  title: string
  items: ReadonlyArray<NavItem>
  future?: ReadonlyArray<FutureItem>
}

const SECTIONS: ReadonlyArray<NavSection> = [
  {
    title: 'observe',
    items: [
      { to: '/', label: 'Dashboard', shortcut: 'D01', Icon: LayoutDashboard },
      { to: '/requests', label: 'Requests', shortcut: 'R02', Icon: ScrollText },
      { to: '/logs', label: 'Logs', shortcut: 'L03', Icon: Terminal },
      { to: '/system', label: 'System', shortcut: 'S04', Icon: ServerCog },
    ],
  },
  {
    title: 'interact',
    items: [
      { to: '/models', label: 'Models', shortcut: 'M05', Icon: Boxes },
      { to: '/playground', label: 'Playground', shortcut: 'P06', Icon: MessageSquare },
    ],
  },
  {
    title: 'configure',
    items: [
      { to: '/config', label: 'Config', shortcut: 'C07', Icon: Settings },
      { to: '/keys', label: 'API Keys', shortcut: 'K08', Icon: KeyRound },
      { to: '/attribution', label: 'Attribution', shortcut: 'A09', Icon: Fingerprint },
      { to: '/policies', label: 'Policies', shortcut: 'P10', Icon: Shield },
      { to: '/endpoints', label: 'Endpoints', shortcut: 'E11', Icon: Link2 },
      { to: '/settings', label: 'Settings', shortcut: 'S12', Icon: SlidersHorizontal },
    ],
  },
]

const NAV_LINK =
  'flex items-center gap-2 py-1.5 px-2.5 text-[13px] font-medium -tracking-[0.005em] text-fg-muted transition-[background-color,color,box-shadow] duration-120 hover:bg-surface-3 hover:text-fg'
const NAV_LINK_ACTIVE = `${NAV_LINK} !bg-surface-3 !text-fg shadow-[inset_2px_0_0_var(--accent)]`

export function Sidebar() {
  const { open, close } = useMobileMenu()
  const { data: running = [] } = useRunningModels()
  const { data: allModels } = useModels()
  const { data: gpu } = useGpu()
  const { data: system } = useSystemStatus()
  const { data: session } = authClient.useSession()
  const colorTheme = useColorTheme()
  const activeTheme = colorTheme.themes.find((theme) => theme.id === colorTheme.themeId) ?? colorTheme.themes[0]
  const avatarColors = [
    activeTheme.accent['300'],
    activeTheme.accent['500'],
    activeTheme.accent['700'],
    activeTheme.status.info,
    activeTheme.status.warn,
  ]

  const capabilities = system?.inference.capabilities
  const runningCount = running.length
  const totalCount = allModels?.length ?? 0
  const visibleSections = SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => {
      if (item.to === '/logs') return capabilities?.logs !== false
      if (item.to === '/config') return capabilities?.config !== false
      return true
    }),
  })).filter((section) => section.items.length > 0 || section.future?.length)

  const [visibleIdx, setVisibleIdx] = useState(0)
  const [slide, setSlide] = useState<'out' | 'in' | null>(null)
  const nextIdx = useRef(0)
  useEffect(() => {
    if (runningCount <= 1) {
      setSlide(null)
      return
    }
    const id = setInterval(() => {
      nextIdx.current = (nextIdx.current + 1) % runningCount
      setSlide('out')
    }, 8_000)
    return () => clearInterval(id)
  }, [runningCount])
  useEffect(() => {
    if (slide === 'out') {
      const t = setTimeout(() => {
        setVisibleIdx(nextIdx.current)
        setSlide('in')
      }, 300)
      return () => clearTimeout(t)
    }
    if (slide === 'in') {
      const t = setTimeout(() => setSlide(null), 300)
      return () => clearTimeout(t)
    }
  }, [slide])
  const resident = runningCount > 0 ? running[visibleIdx % runningCount] : null

  const gpuCard = gpu?.available ? gpu.gpus[0] : null
  const hasVram = gpuCard?.memoryTotalMiB != null && gpuCard.memoryUsedMiB != null
  const fmtGiB = (mib: number) => (mib / 1024).toFixed(1)

  async function signOut() {
    await authClient.signOut()
    window.location.href = '/login'
  }

  return (
    <aside
      className={cn(
        'bg-surface-0 border-r border-border flex flex-col overflow-hidden',
        'max-md:fixed max-md:top-0 max-md:left-0 max-md:bottom-0 max-md:w-[260px] max-md:z-[100] max-md:-translate-x-full max-md:transition-transform max-md:duration-200',
        open && 'max-md:translate-x-0',
      )}
    >
      <div className="flex items-center gap-2.5 px-4 border-b border-border h-12">
        <Logo />
        <a
          href="https://github.com/ndom91/llama-dash"
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono text-[10px] text-fg-faint ml-auto no-underline hover:text-fg-dim"
        >
          {__GIT_COMMIT__}
        </a>
      </div>

      <nav className="flex flex-col p-2 gap-px flex-1 overflow-y-auto" aria-label="Primary">
        {visibleSections.map((section) => (
          <div key={section.title}>
            <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-fg-faint px-2.5 pt-3 pb-1.5">
              {section.title}
            </div>
            {section.items.map(({ to, label, shortcut, Icon }) => {
              const badge = to === '/models' && runningCount > 0 ? String(runningCount) : null
              return (
                <Link
                  key={to}
                  to={to}
                  className={NAV_LINK}
                  activeOptions={{ exact: to === '/' }}
                  activeProps={{ className: NAV_LINK_ACTIVE }}
                  onClick={close}
                >
                  <span className="font-mono text-[9px] font-semibold text-fg-faint tracking-[0.02em] w-6 shrink-0">
                    {shortcut}
                  </span>
                  <Icon className="size-4 shrink-0 text-current" strokeWidth={1.75} aria-hidden="true" />
                  <span>{label}</span>
                  {badge != null ? <span className="ml-auto font-mono text-[10px] text-fg-dim">{badge}</span> : null}
                </Link>
              )
            })}
            {section.future?.map(({ label, shortcut, Icon }) => (
              <span key={label} className={`${NAV_LINK} cursor-default opacity-35`}>
                <span className="font-mono text-[9px] font-semibold text-fg-faint tracking-[0.02em] w-6 shrink-0">
                  {shortcut}
                </span>
                <Icon className="size-4 shrink-0 text-current" strokeWidth={1.75} aria-hidden="true" />
                <span>{label}</span>
              </span>
            ))}
          </div>
        ))}
      </nav>

      <div className="p-2.5 border-t border-border flex flex-col gap-2">
        <div className="py-2.5 px-3 border border-border rounded bg-surface-2 flex flex-col gap-2 overflow-x-clip">
          <div className="flex justify-between items-center gap-2 text-[10px] font-mono uppercase tracking-[0.12em] text-fg-faint">
            <span className="text-fg-muted">{gpuCard?.powerW ?? '-'} W</span>
            <span className="text-fg-muted">
              {hasVram
                ? `${fmtGiB(gpuCard.memoryUsedMiB!)} / ${fmtGiB(gpuCard.memoryTotalMiB!)} GB`
                : resident
                  ? `${visibleIdx} of ${totalCount}`
                  : 'idle'}
            </span>
          </div>
          <div className="h-1 rounded-pill bg-surface-4 overflow-hidden my-1">
            <div
              className="h-full bg-accent rounded-pill transition-[width] duration-300"
              style={{
                width: hasVram
                  ? `${gpuCard.memoryPercent ?? 0}%`
                  : totalCount > 0
                    ? `${(runningCount / totalCount) * 100}%`
                    : '0%',
              }}
            />
          </div>
          {resident ? (
            <div className={cn(slide === 'out' && 'ticker-out', slide === 'in' && 'ticker-in')}>
              <div className="font-mono text-xs text-fg break-all leading-[1.3] overflow-visible">
                <StatusDot tone={stateTone(resident.state, true)} live />{' '}
                <span style={{ marginLeft: 6 }} translate="no">
                  {resident.id}
                </span>
              </div>
              <div className="font-mono text-[10px] text-fg-dim">{system?.inference.label ?? 'backend'}</div>
            </div>
          ) : (
            <>
              <div className="font-mono text-xs text-fg-dim break-all leading-[1.3]">
                <StatusDot tone="idle" />
                <span style={{ marginLeft: 6 }}>idle</span>
              </div>
              <div className="font-mono text-[10px] text-fg-dim">
                {gpuCard ? gpuCard.name : 'no models loaded'}
                {gpuCard?.cores != null ? ` · ${gpuCard.cores} cores` : ''}
              </div>
            </>
          )}
        </div>
        <div className="flex items-center gap-2 rounded border border-border bg-surface-2 px-3 py-2">
          <div className="size-7 shrink-0 overflow-hidden rounded-full border border-border bg-surface-3">
            <Avatar
              name={session?.user.email || session?.user.name || 'dashboard user'}
              variant="marble"
              size={28}
              colors={avatarColors}
              title={false}
              aria-hidden="true"
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate font-mono text-[10px] uppercase tracking-[0.12em] text-fg-faint">signed in</div>
            <Tooltip label={session?.user.email ?? 'dashboard user'} side="top" align="start">
              <div className="truncate font-mono text-xs text-fg">{session?.user.email ?? 'dashboard user'}</div>
            </Tooltip>
          </div>
          <Tooltip label="Signout">
            <button type="button" className="btn btn-ghost btn-icon" onClick={signOut} aria-label="Signout">
              <LogOut className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
            </button>
          </Tooltip>
        </div>
      </div>
    </aside>
  )
}
