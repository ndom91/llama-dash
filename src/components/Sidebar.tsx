import { Link } from '@tanstack/react-router'
import { Boxes, KeyRound, LayoutDashboard, ScrollText, Settings, Terminal } from 'lucide-react'
import { useGpu, useModels, useRunningModels } from '../lib/queries'
import { StatusDot, stateTone } from './StatusDot'

type NavItem = {
  to: '/' | '/models' | '/requests' | '/logs'
  label: string
  shortcut: string
  Icon: typeof LayoutDashboard
}

const NAV: ReadonlyArray<NavItem> = [
  { to: '/', label: 'Dashboard', shortcut: 'D01', Icon: LayoutDashboard },
  { to: '/models', label: 'Models', shortcut: 'M02', Icon: Boxes },
  { to: '/requests', label: 'Requests', shortcut: 'R03', Icon: ScrollText },
  { to: '/logs', label: 'Logs', shortcut: 'L04', Icon: Terminal },
]

type FutureItem = { label: string; shortcut: string; Icon: typeof LayoutDashboard }

const FUTURE: ReadonlyArray<FutureItem> = [
  { label: 'API Keys', shortcut: 'K05', Icon: KeyRound },
  { label: 'Config', shortcut: 'C06', Icon: Settings },
]

export function Sidebar() {
  const { data: running = [] } = useRunningModels()
  const { data: allModels } = useModels()
  const { data: gpu } = useGpu()

  const resident = running[0] ?? null
  const runningCount = running.length
  const totalCount = allModels?.length ?? 0

  const gpuCard = gpu?.available ? gpu.gpus[0] : null
  const hasVram = gpuCard?.memoryTotalMiB != null && gpuCard.memoryUsedMiB != null
  const fmtGiB = (mib: number) => (mib / 1024).toFixed(1)

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <span className="sidebar-brand-dot" aria-hidden="true" />
        <span className="sidebar-brand-name" translate="no">
          llama-dash
        </span>
        <span className="sidebar-brand-version">{__GIT_COMMIT__}</span>
      </div>

      <nav className="sidebar-nav" aria-label="Primary">
        <div className="sidebar-section">navigate</div>
        {NAV.map(({ to, label, shortcut, Icon }) => {
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
        {FUTURE.map(({ label, shortcut, Icon }) => (
          <span key={label} className="nav-link nav-link-future">
            <span className="nav-link-shortcut">{shortcut}</span>
            <Icon className="nav-link-icon" strokeWidth={1.75} aria-hidden="true" />
            <span>{label}</span>
          </span>
        ))}
      </nav>

      <div className="sidebar-foot">
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
