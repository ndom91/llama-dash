import { Link } from '@tanstack/react-router'
import {
  Boxes,
  KeyRound,
  LayoutDashboard,
  Link2,
  MessageSquare,
  ScrollText,
  Settings,
  Shield,
  Terminal,
} from 'lucide-react'
import { cn } from '../lib/cn'
import { useColorTheme } from '../lib/use-color-theme'
import { useMobileMenu } from '../lib/use-mobile-menu'
import { useGpu, useModels, useRunningModels } from '../lib/queries'
import { StatusDot, stateTone } from './StatusDot'
import { ThemeToggle } from './ThemeToggle'
import { Tooltip } from './Tooltip'
import { Logo } from './Logo'

type NavItem = {
  to: '/' | '/models' | '/requests' | '/logs' | '/playground' | '/config' | '/keys' | '/endpoints' | '/policies'
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
    ],
  },
  {
    title: 'interact',
    items: [
      { to: '/models', label: 'Models', shortcut: 'M04', Icon: Boxes },
      { to: '/playground', label: 'Playground', shortcut: 'P05', Icon: MessageSquare },
    ],
  },
  {
    title: 'configure',
    items: [
      { to: '/config', label: 'Config', shortcut: 'C06', Icon: Settings },
      { to: '/keys', label: 'API Keys', shortcut: 'K07', Icon: KeyRound },
      { to: '/policies', label: 'Policies', shortcut: 'P09', Icon: Shield },
      { to: '/endpoints', label: 'Endpoints', shortcut: 'E10', Icon: Link2 },
    ],
  },
]

const NAV_LINK =
  'flex items-center gap-2 py-1.5 px-2.5 text-[13px] font-medium -tracking-[0.005em] text-fg-muted transition-[background-color,color,box-shadow] duration-[120ms] hover:bg-surface-3 hover:text-fg'
const NAV_LINK_ACTIVE = `${NAV_LINK} !bg-surface-3 !text-fg shadow-[inset_2px_0_0_var(--accent)]`

export function Sidebar() {
  const { open, close } = useMobileMenu()
  const { data: running = [] } = useRunningModels()
  const { data: allModels } = useModels()
  const { data: gpu } = useGpu()
  const colorTheme = useColorTheme()

  const resident = running[0] ?? null
  const runningCount = running.length
  const totalCount = allModels?.length ?? 0

  const gpuCard = gpu?.available ? gpu.gpus[0] : null
  const hasVram = gpuCard?.memoryTotalMiB != null && gpuCard.memoryUsedMiB != null
  const fmtGiB = (mib: number) => (mib / 1024).toFixed(1)

  return (
    <aside
      className={cn(
        'bg-surface-1 border-r border-border flex flex-col overflow-hidden',
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
        {SECTIONS.map((section) => (
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
        <div className="flex items-center gap-2 border border-border rounded bg-surface-2 py-1.5 px-2 pl-3">
          <div className="flex justify-between flex-1">
            {colorTheme.themes.map((t) => (
              <Tooltip key={t.id} label={t.name} side="top">
                <button
                  type="button"
                  className={cn(
                    'size-3 rounded-pill border-2 border-transparent cursor-pointer transition-[border-color,box-shadow] duration-150',
                    'hover:shadow-[0_0_0_2px_var(--bg-0),0_0_0_4px_var(--fg-dim)]',
                    t.id === colorTheme.themeId && 'shadow-[0_0_0_2px_var(--bg-0),0_0_0_4px_var(--fg)]',
                  )}
                  style={{ background: t.accent['500'] }}
                  onClick={() => colorTheme.select(t.id)}
                  aria-label={t.name}
                />
              </Tooltip>
            ))}
          </div>
          <ThemeToggle />
        </div>
        <div className="py-2.5 px-3 border border-border rounded bg-surface-2 flex flex-col gap-1">
          <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.12em] text-fg-faint">
            <span>vram ·</span>
            <span className="ml-auto text-fg-muted">
              {hasVram
                ? `${fmtGiB(gpuCard.memoryUsedMiB!)} / ${fmtGiB(gpuCard.memoryTotalMiB!)} GiB`
                : resident
                  ? `${runningCount} of ${totalCount}`
                  : 'idle'}
            </span>
          </div>
          <div className="h-[3px] rounded-pill bg-surface-4 overflow-hidden my-1">
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
            <>
              <div className="font-mono text-xs text-fg break-all leading-[1.3]">
                <StatusDot tone={stateTone(resident.state, true)} live />{' '}
                <span style={{ marginLeft: 6 }} translate="no">
                  {resident.id}
                </span>
              </div>
              <div className="font-mono text-[10px] text-fg-dim">
                {resident.state}
                {resident.ttl != null ? ` · ttl=${resident.ttl}` : ''}
                {runningCount > 1 ? ` · ${runningCount} of ${totalCount}` : ` · 1 of ${totalCount}`}
                {hasVram ? ` · ${gpuCard.memoryPercent}%` : ''}
              </div>
            </>
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
      </div>
    </aside>
  )
}
