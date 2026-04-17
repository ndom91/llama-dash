import { useMatches } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { useHealth, useModels } from '../lib/queries'
import { StatusDot } from './StatusDot'
import { ThemeToggle } from './ThemeToggle'

function resolveTitle(pathname: string): string {
  if (pathname === '/') return 'Dashboard'
  if (pathname === '/models') return 'Models'
  if (pathname.startsWith('/requests')) return 'Requests'
  return 'llama-dash'
}

export function TopBar({ actions }: { actions?: ReactNode }) {
  const matches = useMatches()
  const leaf = matches[matches.length - 1]?.pathname ?? '/'
  const title = resolveTitle(leaf)
  const { data: health } = useHealth()
  const { data: models } = useModels()

  const reachable = health?.upstream.reachable === true
  const version = health?.upstream.reachable === true ? health.upstream.version : null
  const running = models?.filter((m) => m.running).length ?? 0

  return (
    <header className="topbar">
      <span className="topbar-title">{title}</span>
      <span className="topbar-sep" aria-hidden="true" />

      <span className="topbar-chip" title={reachable ? 'llama-swap reachable' : 'llama-swap unreachable'}>
        <StatusDot tone={reachable ? 'ok' : 'err'} live={reachable} />
        <span>upstream</span>
        {version ? (
          <span className="topbar-chip-num" translate="no">
            v{version}
          </span>
        ) : (
          <span className="topbar-chip-num">—</span>
        )}
      </span>

      <span className="topbar-chip" title="Currently loaded models">
        <span>running</span>
        <span className="topbar-chip-num">{models == null ? '—' : running}</span>
      </span>

      <div className="topbar-actions">
        {actions}
        <ThemeToggle />
      </div>
    </header>
  )
}
