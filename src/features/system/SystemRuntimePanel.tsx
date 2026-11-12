import { useCompactDatabase } from '../../lib/queries'
import type { ApiSystemStatus, ModelPricingStatus } from '../../lib/schemas/system'
import { MetaRow } from './MetaRow'
import { SystemPanel } from './SystemPanel'
import { formatBytesShort, formatUptime } from './systemMetrics'

/** Keeps the filename and its parent directory; long absolute paths overflow the narrow grid cell. */
function shortPath(path: string): string {
  const parts = path.split('/').filter(Boolean)
  return parts.length <= 2 ? path : `…/${parts.slice(-2).join('/')}`
}

function formatPricingStatus(pricing: ModelPricingStatus): string {
  switch (pricing.status) {
    case 'ready':
      return `ready · ${pricing.count.toLocaleString()} models`
    case 'unavailable':
      return `unavailable · ${pricing.reason}`
    default:
      return pricing.status
  }
}

function UpdateStatus({ update }: { update: ApiSystemStatus['runtime']['update'] }) {
  if (update.status === 'available') {
    const label = update.latest ? `update available · ${update.latest}` : 'update available'
    return update.url ? (
      <a className="text-accent hover:underline" href={update.url} target="_blank" rel="noreferrer">
        {label}
      </a>
    ) : (
      label
    )
  }
  if (update.status === 'current') return <span className="text-ok">current</span>
  if (update.status === 'error') return 'check failed'
  return 'unknown'
}

export function SystemRuntimePanel({ status }: { status: ApiSystemStatus }) {
  const { runtime, database } = status
  const compact = useCompactDatabase()
  return (
    <SystemPanel title="Runtime & Database">
      <dl className="m-0">
        <MetaRow label="uptime" value={formatUptime(runtime.uptimeSec)} />
        <MetaRow label="node · commit" value={`${runtime.nodeVersion} · ${runtime.gitCommit.slice(0, 7)}`} />
        <MetaRow label="updates" value={<UpdateStatus update={runtime.update} />} />
        <MetaRow label="pricing" value={formatPricingStatus(runtime.pricing)} />
        <MetaRow
          label="db"
          value={
            <span className="inline-flex flex-wrap items-center justify-end gap-x-2">
              <span title={database.path}>{shortPath(database.path)}</span>
              <button
                type="button"
                className="text-info hover:underline disabled:opacity-50"
                disabled={compact.isPending}
                onClick={() => compact.mutate()}
                title="Compaction can pause the dashboard and proxy while it runs"
              >
                {compact.isPending ? 'compacting…' : 'compact'}
              </button>
            </span>
          }
        />
        <MetaRow
          label="db size · rows"
          value={`${database.sizeBytes == null ? '—' : formatBytesShort(database.sizeBytes)} · ${database.requestRows.toLocaleString()} req`}
        />
      </dl>
    </SystemPanel>
  )
}
