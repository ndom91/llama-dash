import { Menu } from 'lucide-react'
import { type ReactNode, useEffect, useState } from 'react'
import { useMobileMenu } from '../lib/use-mobile-menu'
import { useHealth, useModelCounts, useRequestStats } from '../lib/queries'
import { StatusDot } from './StatusDot'
import { Tooltip } from './Tooltip'

export function TopBar({ actions }: { actions?: ReactNode }) {
  const { toggle } = useMobileMenu()

  return (
    <header className="bg-surface-1 border-b border-border h-12 flex items-center gap-3 px-4 shrink-0">
      <button
        type="button"
        className="hidden max-md:inline-flex items-center justify-center text-fg p-2.5 cursor-pointer -ml-1.5"
        onClick={toggle}
        aria-label="Toggle menu"
      >
        <Menu size={20} strokeWidth={1.75} />
      </button>
      <TopBarLiveStats />
      <div className="ml-auto flex items-center gap-1.5">
        {actions}
        <TopBarClock />
      </div>
    </header>
  )
}

function TopBarLiveStats() {
  const { data: health } = useHealth()
  const { data: counts } = useModelCounts()
  const { data: stats } = useRequestStats()

  const reachable = health?.upstream.reachable === true
  const version = health?.upstream.reachable === true ? health.upstream.version : null
  const backendLabel = health?.upstream.backend ?? 'backend'

  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])

  const typeLabel = mounted ? backendLabel : '—'
  const versionLabel = mounted && version ? `v${version}` : '—'
  const runningLabel = mounted ? (counts?.running ?? '—') : '—'
  const peerLabel = mounted && counts && counts.peers > 0 ? counts.peers : null
  const reqRateLabel = mounted && stats ? formatRate(stats.reqPerSec) : '—'

  return (
    <>
      <Tooltip label={reachable ? `${backendLabel} reachable` : `${backendLabel} unreachable`} side="bottom">
        <span className="inline-flex items-center gap-1.5 rounded-sm px-2 py-1 font-mono text-[11px] text-fg-muted -tracking-[0.005em] max-md:hidden">
          <StatusDot tone={reachable ? 'ok' : 'err'} live={reachable} />
          <span>upstream</span>
          <span className="font-medium text-fg" translate="no">
            {typeLabel}
          </span>
          <span className="font-medium text-fg tabular-nums" translate="no">
            {versionLabel}
          </span>
        </span>
      </Tooltip>

      <Tooltip label="Currently loaded models" side="bottom">
        <span className="inline-flex items-center gap-1.5 rounded-sm px-2 py-1 font-mono text-[11px] text-fg-muted -tracking-[0.005em] max-md:hidden">
          <span>running</span>
          <span className="font-medium text-fg tabular-nums">{runningLabel}</span>
          {peerLabel != null ? (
            <>
              <span className="-mx-0.5 text-fg-faint" aria-hidden="true">
                ·
              </span>
              <span>peer</span>
              <span className="font-medium text-fg tabular-nums">{peerLabel}</span>
            </>
          ) : null}
        </span>
      </Tooltip>

      <Tooltip label="Requests per second (1 min)" side="bottom">
        <span className="inline-flex items-center gap-1.5 rounded-sm px-2 py-1 font-mono text-[11px] text-fg-muted -tracking-[0.005em] max-md:hidden">
          <span>req/s</span>
          <span className="font-medium text-fg tabular-nums">{reqRateLabel}</span>
        </span>
      </Tooltip>
    </>
  )
}

function TopBarClock() {
  const [now, setNow] = useState(() => new Date())
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <span className="text-[11px] text-fg-dim -tracking-[0.01em] font-mono tabular-nums max-md:hidden">
      {mounted ? formatDatetime(now) : '—'}
    </span>
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
