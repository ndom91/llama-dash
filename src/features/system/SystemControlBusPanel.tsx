import type { ApiSystemStatus } from '../../lib/schemas/system'
import { MetaRow } from './MetaRow'
import { SystemPanel } from './SystemPanel'

export function SystemControlBusPanel({ status }: { status: ApiSystemStatus }) {
  return (
    <SystemPanel title="Control Bus">
      <dl className="m-0">
        <MetaRow label="backend" value={status.inference.label} />
        <MetaRow label="upstream" value={status.proxy.upstreamBaseUrl.replace(/^https?:\/\//, '')} />
        <MetaRow label="tls" value={status.proxy.insecureTls ? 'insecure (verification off)' : 'standard'} />
        <MetaRow label="metrics" value="/metrics" />
        <MetaRow label="direct targets" value={status.proxy.directTargets.length} />
      </dl>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {status.proxy.directTargets.map((target) => (
          <span
            key={target}
            className="rounded-sm border border-border/70 bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-fg-dim"
          >
            {target.replace('https://', '')}
          </span>
        ))}
      </div>
    </SystemPanel>
  )
}
