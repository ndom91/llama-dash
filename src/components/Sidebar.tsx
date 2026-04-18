import { Link } from '@tanstack/react-router'
import { Boxes, KeyRound, LayoutDashboard, MessageSquare, ScrollText, Settings, Terminal } from 'lucide-react'
import { useColorTheme } from '../lib/use-color-theme'
import { useGpu, useModels, useRunningModels } from '../lib/queries'
import { StatusDot, stateTone } from './StatusDot'
import { ThemeToggle } from './ThemeToggle'
import { Tooltip } from './Tooltip'
import { Logo } from './Logo'

type NavItem = {
  to: '/' | '/models' | '/requests' | '/logs' | '/playground' | '/config'
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
    items: [{ to: '/config', label: 'Config', shortcut: 'C06', Icon: Settings }],
    future: [{ label: 'API Keys', shortcut: 'K07', Icon: KeyRound }],
  },
]

export function Sidebar() {
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
    <aside className="sidebar">
      <div className="sidebar-brand">
        <Logo />
        <span className="sidebar-brand-version">{__GIT_COMMIT__}</span>
      </div>

      <nav className="sidebar-nav" aria-label="Primary">
        {SECTIONS.map((section) => (
          <div key={section.title} className="sidebar-nav-section">
            <div className="sidebar-section">{section.title}</div>
            {section.items.map(({ to, label, shortcut, Icon }) => {
              const badge = to === '/models' && runningCount > 0 ? String(runningCount) : null
              return (
                <Link
                  key={to}
                  to={to}
                  className="nav-link"
                  activeOptions={{ exact: to === '/' }}
                  activeProps={{ className: 'nav-link is-active' }}
                >
                  <span className="nav-link-shortcut">{shortcut}</span>
                  <Icon className="nav-link-icon" strokeWidth={1.75} aria-hidden="true" />
                  <span>{label}</span>
                  {badge != null ? <span className="nav-link-badge">{badge}</span> : null}
                </Link>
              )
            })}
            {section.future?.map(({ label, shortcut, Icon }) => (
              <span key={label} className="nav-link nav-link-future">
                <span className="nav-link-shortcut">{shortcut}</span>
                <Icon className="nav-link-icon" strokeWidth={1.75} aria-hidden="true" />
                <span>{label}</span>
              </span>
            ))}
          </div>
        ))}
      </nav>

      <div className="sidebar-foot">
        <div className="theme-row">
          <div className="theme-picker">
            {colorTheme.themes.map((t) => (
              <Tooltip key={t.id} label={t.name} side="top">
                <button
                  type="button"
                  className={`theme-swatch${t.id === colorTheme.themeId ? ' is-active' : ''}`}
                  style={{ background: t.accent['500'] }}
                  onClick={() => colorTheme.select(t.id)}
                  aria-label={t.name}
                />
              </Tooltip>
            ))}
          </div>
          <ThemeToggle />
        </div>
        <div className="resident">
          <div className="resident-head">
            <span>vram ·</span>
            <span className="resident-head-val">
              {hasVram
                ? `${fmtGiB(gpuCard.memoryUsedMiB!)} / ${fmtGiB(gpuCard.memoryTotalMiB!)} GiB`
                : resident
                  ? `${runningCount} of ${totalCount}`
                  : 'idle'}
            </span>
          </div>
          <div className="resident-bar-track">
            <div
              className="resident-bar-fill"
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
              <div className="resident-body">
                <StatusDot tone={stateTone(resident.state, true)} live />{' '}
                <span style={{ marginLeft: 6 }} translate="no">
                  {resident.id}
                </span>
              </div>
              <div className="resident-meta">
                {resident.state}
                {resident.ttl != null ? ` · ttl=${resident.ttl}` : ''}
                {runningCount > 1 ? ` · ${runningCount} of ${totalCount}` : ` · 1 of ${totalCount}`}
                {hasVram ? ` · ${gpuCard.memoryPercent}%` : ''}
              </div>
            </>
          ) : (
            <>
              <div className="resident-body is-idle">
                <StatusDot tone="idle" />
                <span style={{ marginLeft: 6 }}>idle</span>
              </div>
              <div className="resident-meta">
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
