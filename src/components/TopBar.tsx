import { useMatches } from '@tanstack/react-router'
import { type ReactNode, useEffect, useState } from 'react'
import { useHealth, useModelCounts, useRequestStats } from '../lib/queries'
import { StatusDot } from './StatusDot'

function resolveTitle(pathname: string): string {
  if (pathname === '/') return 'Dashboard'
  if (pathname === '/models') return 'Models'
  if (pathname.startsWith('/requests')) return 'Requests'
  if (pathname === '/logs') return 'Logs'
  if (pathname === '/playground') return 'Playground'
  if (pathname === '/keys') return 'API Keys'
  return 'llama-dash'
}

export function TopBar({ actions }: { actions?: ReactNode }) {
  const matches = useMatches()
  const leaf = matches[matches.length - 1]?.pathname ?? '/'
  const title = resolveTitle(leaf)
  const { data: health } = useHealth()
  const { data: counts } = useModelCounts()
  const { data: stats } = useRequestStats()

  const reachable = health?.upstream.reachable === true
  const version = health?.upstream.reachable === true ? health.upstream.version : null

  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

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
        <span className="topbar-chip-num">{counts?.running ?? '—'}</span>
        {counts && counts.peers > 0 ? (
          <>
            <span className="topbar-chip-sep" aria-hidden="true">
              ·
            </span>
            <span>peer</span>
            <span className="topbar-chip-num">{counts.peers}</span>
          </>
        ) : null}
      </span>

      <span className="topbar-chip" title="Requests per second (1 min)">
        <span>req/s</span>
        <span className="topbar-chip-num">{stats ? formatRate(stats.reqPerSec) : '—'}</span>
      </span>

      <div className="topbar-actions">
        {actions}
        <span className="topbar-datetime mono">{formatDatetime(now)}</span>
      </div>
    </header>
  )
}

function formatRate(v: number): string {
  if (v === 0) return '0.0'
  if (v < 0.1) return v.toFixed(2)
  return v.toFixed(1)
}

function formatDatetime(d: Date): string {
  const y = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const da = String(d.getDate()).padStart(2, '0')
  const h = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  const s = String(d.getSeconds()).padStart(2, '0')
  return `${y}-${mo}-${da} · ${h}:${mi}:${s}`
}
