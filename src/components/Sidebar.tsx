import type { HotkeySequence } from '@tanstack/react-hotkeys'
import { useHotkeySequence } from '@tanstack/react-hotkeys'
import { Link, useNavigate } from '@tanstack/react-router'
import Avatar from 'boring-avatars'
import {
  Boxes,
  Fingerprint,
  KeyRound,
  LayoutDashboard,
  Link2,
  LogOut,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  ScrollText,
  ServerCog,
  Settings,
  Shield,
  SlidersHorizontal,
  Terminal,
  TriangleAlert,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { authClient } from '../lib/auth-client'
import { cn } from '../lib/cn'
import { LEADER_KEY } from '../lib/nav-leader'
import { useGpu, useModels, useRunningModels, useSystemStatus } from '../lib/queries'
import type { ApiSystemStatus } from '../lib/schemas/system'
import { useColorTheme } from '../lib/use-color-theme'
import { useMobileMenu } from '../lib/use-mobile-menu'
import { Logo } from './Logo'
import { StatusDot, stateTone } from './StatusDot'
import { Tooltip } from './Tooltip'

type NavTarget =
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

type NavItem = {
  to: NavTarget
  label: string
  /**
   * Second key of the `g`-leader sequence. These replaced decorative codes
   * (`D01`, `R02`, …) that nothing read — the letters weren't even unique
   * (`P06` Playground vs `P10` Policies) and the ordinals renumbered whenever a
   * nav item was hidden by backend capability.
   */
  leader: string
  Icon: typeof LayoutDashboard
}

type NavSection = {
  title: string
  items: ReadonlyArray<NavItem>
}

const SECTIONS: ReadonlyArray<NavSection> = [
  {
    title: 'observe',
    items: [
      { to: '/', label: 'Dashboard', leader: 'd', Icon: LayoutDashboard },
      { to: '/requests', label: 'Requests', leader: 'r', Icon: ScrollText },
      { to: '/logs', label: 'Logs', leader: 'l', Icon: Terminal },
      { to: '/system', label: 'System', leader: 's', Icon: ServerCog },
    ],
  },
  {
    title: 'interact',
    items: [
      { to: '/models', label: 'Models', leader: 'm', Icon: Boxes },
      { to: '/playground', label: 'Playground', leader: 'p', Icon: MessageSquare },
    ],
  },
  {
    title: 'configure',
    items: [
      { to: '/config', label: 'Config', leader: 'c', Icon: Settings },
      { to: '/keys', label: 'API Keys', leader: 'k', Icon: KeyRound },
      { to: '/attribution', label: 'Attribution', leader: 'a', Icon: Fingerprint },
      // 'p' belongs to Playground (used daily); Policies takes its second letter.
      { to: '/policies', label: 'Policies', leader: 'o', Icon: Shield },
      { to: '/endpoints', label: 'Endpoints', leader: 'e', Icon: Link2 },
      // ',' is the conventional preferences key; 's' goes to System, which an
      // operator visits far more often than a configure-once page.
      { to: '/settings', label: 'Settings', leader: ',', Icon: SlidersHorizontal },
    ],
  },
]

/**
 * Registers one `g <key>` sequence. Rendered as a component so the hook count
 * stays stable per item even though the visible section list is filtered by
 * backend capability — a hidden route simply gets no binding.
 */
function LeaderNavBinding({ to, leader }: { to: NavTarget; leader: string }) {
  const navigate = useNavigate()
  useHotkeySequence([LEADER_KEY.toUpperCase(), leader.toUpperCase()] as HotkeySequence, (event) => {
    event.preventDefault()
    navigate({ to })
  })
  return null
}

const NAV_LINK =
  'flex items-center gap-2 py-1.5 px-2.5 text-[13px] font-medium -tracking-[0.005em] text-fg-muted transition-[background-color,color,box-shadow] duration-120 hover:bg-surface-3 hover:text-fg'
const NAV_LINK_ACTIVE = `${NAV_LINK} !bg-surface-3 !text-fg shadow-[inset_2px_0_0_var(--accent)]`

type SidebarSession = ReturnType<typeof authClient.useSession>['data']

type SidebarProps = {
  /** Desktop only: an icon rail. Phones keep the slide-in menu at full width. */
  collapsed?: boolean
  onToggleCollapsed?: () => void
  initialSession?: SidebarSession | null
  initialCapabilities?: ApiSystemStatus['inference']['capabilities'] | null
}

export function Sidebar({ collapsed = false, onToggleCollapsed, initialSession, initialCapabilities }: SidebarProps) {
  const { open, close } = useMobileMenu()
  const { data: system } = useSystemStatus()
  const updateAvailable = system?.runtime.update.status === 'available'

  return (
    <aside
      className={cn(
        'bg-surface-0 border-r border-border flex flex-col overflow-hidden',
        'max-md:fixed max-md:top-0 max-md:left-0 max-md:bottom-0 max-md:w-[260px] max-md:z-[100] max-md:-translate-x-full max-md:transition-transform max-md:duration-200',
        open && 'max-md:translate-x-0',
      )}
    >
      <div
        className={cn(
          'flex items-center gap-2.5 px-4 border-b border-border h-12',
          collapsed && 'md:justify-center md:px-0',
        )}
      >
        <div className={cn(collapsed && 'md:hidden')}>
          <Logo />
        </div>
        <div className={cn('ml-auto flex items-center gap-1.5', collapsed && 'md:hidden')}>
          {updateAvailable ? (
            <Tooltip label="Update available" side="bottom" align="end">
              <a
                href="https://github.com/ndom91/llama-dash"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex size-4 items-center justify-center rounded-sm text-warn/80 transition-[color,filter] duration-150 hover:text-warn hover:drop-shadow-[0_0_6px_color-mix(in_srgb,var(--warn)_65%,transparent)]"
                aria-label="Update available"
              >
                <TriangleAlert className="size-3" strokeWidth={1.75} aria-hidden="true" />
              </a>
            </Tooltip>
          ) : null}
          <a
            href="https://github.com/ndom91/llama-dash"
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-[10px] text-fg-faint no-underline hover:text-fg-dim"
          >
            {__GIT_COMMIT__}
          </a>
        </div>
        {onToggleCollapsed ? (
          <Tooltip label={collapsed ? 'Expand sidebar  [' : 'Collapse sidebar  ['} side="right">
            <button
              type="button"
              className={cn('btn btn-ghost btn-icon max-md:hidden', !collapsed && '-mr-2')}
              onClick={onToggleCollapsed}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-expanded={!collapsed}
            >
              {collapsed ? (
                <PanelLeftOpen className="size-4" strokeWidth={1.75} aria-hidden="true" />
              ) : (
                <PanelLeftClose className="size-4" strokeWidth={1.75} aria-hidden="true" />
              )}
            </button>
          </Tooltip>
        ) : null}
      </div>

      <SidebarNav onNavigate={close} initialCapabilities={initialCapabilities} collapsed={collapsed} />
      <div className={cn(collapsed && 'md:hidden')}>
        <SidebarLiveStatus initialSession={initialSession} />
      </div>
    </aside>
  )
}

function SidebarNav({
  onNavigate,
  initialCapabilities,
  collapsed = false,
}: {
  onNavigate: () => void
  initialCapabilities?: ApiSystemStatus['inference']['capabilities'] | null
  collapsed?: boolean
}) {
  const { data: running = [] } = useRunningModels()
  const { data: system } = useSystemStatus()

  const capabilities = system?.inference.capabilities ?? initialCapabilities
  const runningCount = running.length
  const visibleSections = SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => {
      if (item.to === '/logs') return capabilities?.logs !== false
      if (item.to === '/config') return capabilities?.config !== false
      return true
    }),
  })).filter((section) => section.items.length > 0)

  return (
    <nav className="flex flex-col p-2 gap-px flex-1 overflow-y-auto" aria-label="Primary">
      {/* Bindings are registered here rather than inside each <Link> so keyboard
          registration isn't entangled with link markup. Driven off the same
          capability-filtered list, so a hidden route gets no binding. */}
      {visibleSections.flatMap((section) =>
        section.items.map((item) => <LeaderNavBinding key={item.to} to={item.to} leader={item.leader} />),
      )}
      {visibleSections.map((section) => (
        <div key={section.title}>
          <div
            className={cn(
              'font-mono text-[10px] uppercase tracking-[0.12em] text-fg-faint px-2.5 pt-3 pb-1.5',
              collapsed && 'md:sr-only',
            )}
          >
            {section.title}
          </div>
          {collapsed ? <div className="max-md:hidden mx-2 my-2 border-t border-border" aria-hidden="true" /> : null}
          {section.items.map(({ to, label, leader, Icon }) => {
            const badge = to === '/models' && runningCount > 0 ? String(runningCount) : null
            const link = (
              <Link
                key={to}
                to={to}
                className={NAV_LINK}
                activeOptions={{ exact: to === '/' }}
                activeProps={{ className: NAV_LINK_ACTIVE }}
                onClick={onNavigate}
              >
                {/* Two adjacent <kbd> elements is how a *sequence* is expressed;
                    one <kbd> wrapping both would mean a single keystroke.
                    Deliberately no aria-keyshortcuts — that attribute is
                    specified for key combinations, so "G D" would be announced
                    as two independent shortcuts. The sr-only text says it
                    properly instead. */}
                <span
                  className={cn('nav-key flex w-7 shrink-0 items-center gap-px', collapsed && 'md:hidden')}
                  aria-hidden="true"
                >
                  <kbd className="nav-key-leader">{LEADER_KEY}</kbd>
                  <kbd className="nav-key-target">{leader}</kbd>
                </span>
                <Icon className="size-4 shrink-0 text-current" strokeWidth={1.75} aria-hidden="true" />
                <span className={cn(collapsed && 'md:sr-only')}>{label}</span>
                <span className="sr-only">{`, shortcut ${LEADER_KEY} then ${leader}`}</span>
                {badge != null ? (
                  <span className={cn('ml-auto font-mono text-[10px] text-fg-dim', collapsed && 'md:hidden')}>
                    {badge}
                  </span>
                ) : null}
              </Link>
            )
            return collapsed ? (
              <Tooltip key={to} label={badge != null ? `${label} · ${badge} running` : label} side="right">
                {link}
              </Tooltip>
            ) : (
              link
            )
          })}
        </div>
      ))}
    </nav>
  )
}

function SidebarLiveStatus({ initialSession }: SidebarProps) {
  const { data: running = [] } = useRunningModels()
  const { data: allModels } = useModels()
  const { data: gpu } = useGpu()
  const { data: system } = useSystemStatus()
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

  const runningCount = running.length
  const totalCount = allModels?.length ?? 0

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
  const cpuUtilizationPercent = gpu?.cpuUtilizationPercent
  const gpuUtilizationPercent = gpuCard?.utilizationPercent
  const hasVram = gpuCard?.memoryTotalMiB != null && gpuCard.memoryUsedMiB != null
  const fmtGiB = (mib: number) => (mib / 1024).toFixed(1)
  const meterWidth = (percent: number | null | undefined) => `${Math.min(Math.max(percent ?? 0, 0), 100)}%`

  async function signOut() {
    await authClient.signOut()
    window.location.href = '/login'
  }

  return (
    <div className="p-2.5 border-t border-border flex flex-col gap-2">
      <div className="py-2.5 px-3 border border-border rounded bg-surface-2 flex flex-col gap-2 overflow-x-clip">
        <div className="flex flex-col gap-2">
          <div>
            <div className="mb-1 flex items-center justify-between gap-2 font-mono text-[10px] tabular-nums uppercase tracking-[0.12em] text-fg-faint">
              <span>{hasVram ? 'vram' : 'models'}</span>
              <span className="text-fg-muted">
                {hasVram
                  ? `${fmtGiB(gpuCard.memoryUsedMiB!)} / ${fmtGiB(gpuCard.memoryTotalMiB!)} GiB`
                  : resident
                    ? `${runningCount} of ${totalCount}`
                    : 'idle'}
              </span>
            </div>
            <div className="h-1 overflow-hidden rounded-pill bg-surface-4">
              <div
                className="h-full rounded-pill bg-accent transition-[width] duration-300"
                style={{
                  width: meterWidth(
                    hasVram ? gpuCard.memoryPercent : totalCount > 0 ? (runningCount / totalCount) * 100 : 0,
                  ),
                }}
              />
            </div>
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between gap-2 font-mono text-[10px] tabular-nums uppercase tracking-[0.12em] text-fg-faint">
              <span>cpu</span>
              <span className="text-fg-muted">{cpuUtilizationPercent != null ? `${cpuUtilizationPercent}%` : '—'}</span>
            </div>
            <div className="h-1 overflow-hidden rounded-pill bg-surface-4">
              <div
                className="h-full rounded-pill bg-accent transition-[width] duration-300"
                style={{ width: meterWidth(cpuUtilizationPercent) }}
              />
            </div>
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between gap-2 font-mono text-[10px] tabular-nums uppercase tracking-[0.12em] text-fg-faint">
              <span>gpu</span>
              <span className="text-fg-muted">{gpuUtilizationPercent != null ? `${gpuUtilizationPercent}%` : '—'}</span>
            </div>
            <div className="h-1 overflow-hidden rounded-pill bg-surface-4">
              <div
                className="h-full rounded-pill bg-accent transition-[width] duration-300"
                style={{ width: meterWidth(gpuUtilizationPercent) }}
              />
            </div>
          </div>
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
            <div
              className="truncate font-mono text-[10px] text-fg-dim"
              title={gpuCard ? `${gpuCard.name}${gpuCard.cores != null ? ` · ${gpuCard.cores} cores` : ''}` : undefined}
            >
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
  )
}
