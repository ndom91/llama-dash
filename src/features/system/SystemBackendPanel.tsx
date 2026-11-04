import { StatusDot } from '../../components/StatusDot'
import { cn } from '../../lib/cn'
import type { ApiSystemStatus } from '../../lib/schemas/system'
import { MetaRow } from './MetaRow'
import { SystemPanel } from './SystemPanel'
import type { Tone } from './systemMetrics'

const CAPABILITY_LABELS: Record<keyof ApiSystemStatus['inference']['capabilities'], string> = {
  models: 'models',
  runningModels: 'running',
  lifecycle: 'lifecycle',
  logs: 'logs',
  config: 'config',
  metrics: 'metrics',
}

export function SystemBackendPanel({
  status,
  version,
  queueTone,
}: {
  status: ApiSystemStatus
  version: string | null
  queueTone: Tone
}) {
  const capabilities = Object.entries(status.inference.capabilities) as Array<[keyof typeof CAPABILITY_LABELS, boolean]>
  const supported = capabilities.filter(([, enabled]) => enabled).length

  return (
    <SystemPanel title="Inference Backend" aside={version ? `${status.inference.label} ${version}` : undefined}>
      <dl className="m-0">
        <MetaRow label="runtime" value={status.inference.label} />
        <MetaRow label="capabilities" value={`${supported} / ${capabilities.length}`} />
      </dl>
      <div className="my-2 flex flex-wrap gap-1.5">
        {capabilities.map(([key, enabled]) => (
          <span
            key={key}
            className={cn(
              'rounded-sm border px-1.5 py-0.5 font-mono text-[10px]',
              enabled ? 'border-border bg-surface-2 text-fg-muted' : 'border-border/50 text-fg-faint line-through',
            )}
          >
            {CAPABILITY_LABELS[key]}
          </span>
        ))}
      </div>
      <dl className="m-0">
        <MetaRow
          label="log queue"
          value={
            <span className="inline-flex items-center gap-1.5">
              <StatusDot tone={queueTone} />
              {status.logging.queued > 0 ? `${status.logging.queued} queued` : 'ready · 0 queued'}
            </span>
          }
        />
        <MetaRow label="dropped" value={status.logging.dropped} />
      </dl>
    </SystemPanel>
  )
}
