import { useMatches } from '@tanstack/react-router'
import { Menu } from 'lucide-react'
import { type ReactNode, useEffect, useState } from 'react'
import { useMobileMenu } from '../lib/use-mobile-menu'
import { useHealth, useModelCounts, useRequestStats } from '../lib/queries'
import { StatusDot } from './StatusDot'

function resolveTitle(pathname: string): string {
  const normalized = pathname !== '/' && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname
  if (normalized === '/') return 'Dashboard'
  if (normalized.startsWith('/models/')) return 'Model Detail'
  if (normalized === '/models') return 'Models'
  if (normalized.startsWith('/requests')) return 'Requests'
  if (normalized === '/logs') return 'Logs'
  if (normalized === '/playground') return 'Playground'
  if (normalized === '/keys') return 'API Keys'
  if (normalized.startsWith('/keys/')) return 'API Key Detail'
  if (normalized === '/config') return 'Config'
  if (normalized === '/settings') return 'Settings'
  if (normalized === '/endpoints') return 'Endpoints'
  if (normalized === '/policies') return 'Policies'
  if (normalized === '/system') return 'System'
  return 'llama-dash'
}

export function TopBar({ actions }: { actions?: ReactNode }) {
  const { toggle } = useMobileMenu()
  const matches = useMatches()
  const leaf = matches[matches.length - 1]?.pathname ?? '/'
  const title = resolveTitle(leaf)
  const { data: health } = useHealth()
  const { data: counts } = useModelCounts()
  const { data: stats } = useRequestStats()

  const reachable = health?.upstream.reachable === true
  const version = health?.upstream.reachable === true ? health.upstream.version : null

  const [now, setNow] = useState(() => new Date())
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const versionLabel = mounted && version ? `v${version}` : '—'
  const runningLabel = mounted ? (counts?.running ?? '—') : '—'
  const peerLabel = mounted && counts && counts.peers > 0 ? counts.peers : null
  const reqRateLabel = mounted && stats ? formatRate(stats.reqPerSec) : '—'
  const timeLabel = mounted ? formatDatetime(now) : '—'

  return (
    <header className="bg-surface-1 border-b border-border h-12 flex items-center gap-3 px-4 shrink-0">
      <button
        type="button"
        className="hidden max-md:inline-flex items-center justify-center text-fg p-1 cursor-pointer mr-1"
        onClick={toggle}
        aria-label="Toggle menu"
      >
        <Menu size={20} strokeWidth={1.75} />
      </button>
      <span className="text-[13px] font-medium -tracking-[0.005em]">{title}</span>
      <span className="w-px self-stretch bg-border my-2.5 mx-1 max-md:hidden" aria-hidden="true" />

      <span
        className="inline-flex items-center gap-1.5 px-2 py-1 rounded-sm font-mono text-[11px] text-fg-muted -tracking-[0.005em] max-md:hidden"
        title={reachable ? 'llama-swap reachable' : 'llama-swap unreachable'}
      >
        <StatusDot tone={reachable ? 'ok' : 'err'} live={reachable} />
        <span>upstream</span>
        <span className="text-fg font-medium" translate="no">
          {versionLabel}
        </span>
      </span>

      <span
        className="inline-flex items-center gap-1.5 px-2 py-1 rounded-sm font-mono text-[11px] text-fg-muted -tracking-[0.005em] max-md:hidden"
        title="Currently loaded models"
      >
        <span>running</span>
        <span className="text-fg font-medium">{runningLabel}</span>
        {peerLabel != null ? (
          <>
            <span className="text-fg-faint -mx-0.5" aria-hidden="true">
              ·
            </span>
            <span>peer</span>
            <span className="text-fg font-medium">{peerLabel}</span>
          </>
        ) : null}
      </span>

      <span
        className="inline-flex items-center gap-1.5 px-2 py-1 rounded-sm font-mono text-[11px] text-fg-muted -tracking-[0.005em] max-md:hidden"
        title="Requests per second (1 min)"
      >
        <span>req/s</span>
        <span className="text-fg font-medium">{reqRateLabel}</span>
      </span>

      <div className="ml-auto flex items-center gap-1.5">
        {actions}
        <span className="text-[11px] text-fg-dim -tracking-[0.01em] font-mono max-md:hidden">{timeLabel}</span>
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
