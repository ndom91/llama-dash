import { Link } from '@tanstack/react-router'
import { Activity, Boxes, LayoutDashboard, ScrollText } from 'lucide-react'
import { useMemo } from 'react'
import { useLiveData } from '../lib/live-data'
import { StatusDot, stateTone } from './StatusDot'

type NavItem = {
  to: '/' | '/models' | '/requests'
  label: string
  Icon: typeof LayoutDashboard
}

/** Nav config — hoisted so we don't rebuild every render. */
const NAV: ReadonlyArray<NavItem> = [
  { to: '/', label: 'Dashboard', Icon: LayoutDashboard },
  { to: '/models', label: 'Models', Icon: Boxes },
  { to: '/requests', label: 'Requests', Icon: ScrollText },
]

export function Sidebar() {
  const { models } = useLiveData()

  const running = useMemo(() => models?.filter((m) => m.running) ?? [], [models])
  const resident = running[0] ?? null
  const runningCount = running.length

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <span className="sidebar-brand-dot" aria-hidden="true" />
        <span className="sidebar-brand-name" translate="no">
          llama-dash
        </span>
      </div>

      <nav className="sidebar-nav" aria-label="Primary">
        <div className="sidebar-section">navigate</div>
        {NAV.map(({ to, label, Icon }) => {
          const badge = to === '/models' && runningCount > 0 ? runningCount : null
          return (
            <Link
              key={to}
              to={to}
              className="nav-link"
              activeOptions={{ exact: to === '/' }}
              activeProps={{ className: 'nav-link is-active' }}
            >
              <Icon className="nav-link-icon" strokeWidth={1.75} aria-hidden="true" />
              <span>{label}</span>
              {badge != null ? <span className="nav-link-badge">{badge}</span> : null}
            </Link>
          )
        })}
      </nav>

      <div className="sidebar-foot">
        <div className="resident">
          <div className="resident-head">
            <Activity className="icon-btn-12" strokeWidth={2} aria-hidden="true" />
            <span>vram resident</span>
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
                state {resident.state}
                {runningCount > 1 ? ` · +${runningCount - 1} more` : ''}
              </div>
            </>
          ) : (
            <>
              <div className="resident-body is-idle">
                <StatusDot tone="idle" />
                <span style={{ marginLeft: 6 }}>idle</span>
              </div>
              <div className="resident-meta">no models loaded</div>
            </>
          )}
        </div>
      </div>
    </aside>
  )
}
