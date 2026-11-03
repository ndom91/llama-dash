import { StatusDot } from '../../components/StatusDot'
import { type PeerHealth, formatAgo } from './modelResidency'

type Props = {
  kind: 'local' | 'peer'
  host: string | null
  health?: PeerHealth
  now: number
}

export function DashboardModelGroupHeader({ kind, host, health, now }: Props) {
  return (
    <div className="flex h-8 items-center gap-3 border-b border-border bg-surface-0/40 px-4 font-mono text-[10px]">
      <span className="uppercase tracking-[0.14em] text-fg-faint">{kind}</span>
      {host ? (
        <span className="text-[11px] text-fg-muted" translate="no">
          {host}
        </span>
      ) : null}
      {health ? (
        <span className="flex items-center gap-1.5 text-[11px] text-fg-dim">
          <StatusDot tone={health.tone} />
          <span className={health.tone === 'idle' ? undefined : `state-label-${health.tone}`}>{health.label}</span>
          {health.lastAt != null ? <span>· last {formatAgo(health.lastAt, now)}</span> : null}
        </span>
      ) : null}
    </div>
  )
}
