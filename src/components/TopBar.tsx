import { useMatches } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { useLiveData } from '../lib/live-data'
import { StatusDot } from './StatusDot'
import { ThemeToggle } from './ThemeToggle'

const TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/models': 'Models',
  '/requests': 'Requests',
}

export function TopBar({ actions }: { actions?: ReactNode }) {
  const matches = useMatches()
  const leaf = matches[matches.length - 1]?.pathname ?? '/'
  const title = TITLES[leaf] ?? 'llama-dash'
  const { health, models } = useLiveData()

  const reachable = health?.upstream.reachable === true
  // Discriminated-union narrow — no cast needed when we read from the checked branch.
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
