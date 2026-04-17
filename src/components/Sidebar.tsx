import { Link } from '@tanstack/react-router'
import { Activity, LayoutDashboard, ScrollText, Boxes } from 'lucide-react'
import { useLiveData } from '../lib/live-data'
import { StatusDot, stateTone } from './StatusDot'

type NavItem = {
  to: '/' | '/models' | '/requests'
  label: string
  Icon: typeof LayoutDashboard
  badge?: string | number | null
}

export function Sidebar() {
  const { models } = useLiveData()
  const running = models?.filter((m) => m.running) ?? []
  const resident = running[0] ?? null

  const nav: Array<NavItem> = [
    { to: '/', label: 'Dashboard', Icon: LayoutDashboard },
    { to: '/models', label: 'Models', Icon: Boxes, badge: running.length || null },
    { to: '/requests', label: 'Requests', Icon: ScrollText },
  ]

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <span className="sidebar-brand-dot" />
        <span className="sidebar-brand-name">llama-dash</span>
      </div>

      <nav className="sidebar-nav">
        <div className="sidebar-section">navigate</div>
        {nav.map(({ to, label, Icon, badge }) => (
          <Link
            key={to}
            to={to}
            className="nav-link"
            activeOptions={{ exact: to === '/' }}
            activeProps={{ className: 'nav-link is-active' }}
          >
            <Icon className="nav-link-icon" strokeWidth={1.75} />
            <span>{label}</span>
            {badge != null ? <span className="nav-link-badge">{badge}</span> : null}
          </Link>
        ))}
      </nav>

      <div className="sidebar-foot">
        <div className="resident">
          <div className="resident-head">
            <Activity className="icon-btn-12" strokeWidth={2} />
            <span>vram resident</span>
          </div>
          {resident ? (
            <>
              <div className="resident-body">
                <StatusDot tone={stateTone(resident.state, true)} live />{' '}
                <span style={{ marginLeft: 6 }}>{resident.id}</span>
              </div>
              <div className="resident-meta">
                state {resident.state}
                {running.length > 1 ? ` · +${running.length - 1} more` : ''}
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
