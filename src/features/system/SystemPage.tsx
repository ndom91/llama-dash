import { PageHeader } from '../../components/PageHeader'
import { StatusDot } from '../../components/StatusDot'
import { cn } from '../../lib/cn'
import { useSystemStatus } from '../../lib/queries'

function formatAge(ms: number | null): string {
  if (ms == null) return 'never'
  if (ms < 1_000) return `${ms}ms ago`
  return `${Math.round(ms / 1_000)}s ago`
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86_400)
  const hours = Math.floor((seconds % 86_400) / 3_600)
  const minutes = Math.floor((seconds % 3_600) / 60)
  const parts = [days > 0 ? `${days}d` : null, hours > 0 || days > 0 ? `${hours}h` : null, `${minutes}m`].filter(
    Boolean,
  )
  return parts.join(' ')
}

function MetaRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid items-center gap-3 border-b border-border/50 py-2.5 last:border-b-0 [grid-template-columns:140px_minmax(0,1fr)]">
      <dt className="font-mono text-[10px] lowercase tracking-[0.04em] text-fg-dim">{label}</dt>
      <dd className="m-0 min-w-0 justify-self-end text-right font-mono text-xs text-fg">{value}</dd>
    </div>
  )
}

function SystemPanel({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn('panel overflow-hidden p-4', className)}>
      <h2 className="m-0 mb-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-fg-faint">
        <span className="h-px w-5 bg-accent/70" />
        {title}
      </h2>
      <dl className="m-0">{children}</dl>
    </section>
  )
}

function RailItem({
  label,
  value,
  tone,
}: {
  label: string
  value: React.ReactNode
  tone: 'ok' | 'warn' | 'err' | 'idle'
}) {
  return (
    <div className="min-w-0 border-l border-border/60 px-4 first:border-l-0 max-md:border-l-0 max-md:border-t max-md:first:border-t-0">
      <div className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-fg-faint">
        <StatusDot tone={tone} /> {label}
      </div>
      <div className="truncate font-mono text-lg font-semibold text-fg">{value}</div>
    </div>
  )
}

function DirectTargets({ targets }: { targets: string[] }) {
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {targets.map((target) => (
        <span
          key={target}
          className="rounded border border-border/70 bg-surface-2 px-2 py-1 font-mono text-[10px] text-fg-dim"
        >
          {target.replace('https://', '')}
        </span>
      ))}
    </div>
  )
}

export function SystemPage() {
  const { data, isLoading, error } = useSystemStatus()

  if (isLoading) {
    return (
      <div className="flex h-full flex-col">
        <PageHeader kicker="Observe · System" title="System" subtitle="Runtime and proxy internals" />
        <main className="flex-1 p-4">
          <div className="panel h-64 animate-pulse bg-surface-2" />
        </main>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex h-full flex-col">
        <PageHeader kicker="Observe · System" title="System" subtitle="Runtime and proxy internals" />
        <main className="flex-1 p-4">
          <div className="panel p-4 text-sm text-danger">Failed to load system status.</div>
        </main>
      </div>
    )
  }

  const queueTone = data.logging.dropped > 0 ? 'err' : data.logging.queued > 0 ? 'warn' : 'ok'
  const gpuTone = data.gpu.available ? 'ok' : 'idle'

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader
        kicker="Observe · System"
        title="System"
        subtitle="Runtime, database, proxy, queue, and poller status."
      />
      <main className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto flex max-w-7xl flex-col gap-4">
          <section className="panel overflow-hidden p-0">
            <div className="grid gap-0 py-4 md:grid-cols-4">
              <RailItem label="runtime" value={formatUptime(data.runtime.uptimeSec)} tone="ok" />
              <RailItem label="queue" value={`${data.logging.queued} queued`} tone={queueTone} />
              <RailItem label="gpu" value={data.gpu.available ? data.gpu.driver : 'offline'} tone={gpuTone} />
              <RailItem label="proxy" value={data.proxy.upstreamHost} tone="ok" />
            </div>
          </section>

          <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
            <SystemPanel title="Control Bus" className="xl:row-span-2">
              <MetaRow label="upstream" value={<span className="break-all">{data.proxy.upstreamBaseUrl}</span>} />
              <MetaRow label="host" value={data.proxy.upstreamHost} />
              <MetaRow label="direct targets" value={data.proxy.directTargets.length} />
              <MetaRow label="insecure tls" value={data.proxy.insecureTls ? 'enabled' : 'disabled'} />
              <DirectTargets targets={data.proxy.directTargets} />
            </SystemPanel>

            <SystemPanel title="Logging Queue">
              <MetaRow
                label="state"
                value={
                  <span className="inline-flex items-center gap-1.5">
                    <StatusDot tone={queueTone} /> {data.logging.dropped > 0 ? 'dropping' : 'ready'}
                  </span>
                }
              />
              <MetaRow label="queued" value={data.logging.queued} />
              <MetaRow label="dropped" value={data.logging.dropped} />
            </SystemPanel>

            <SystemPanel title="GPU Poller">
              <MetaRow
                label="state"
                value={
                  <span className="inline-flex items-center gap-1.5">
                    <StatusDot tone={gpuTone} /> {data.gpu.available ? 'available' : 'unavailable'}
                  </span>
                }
              />
              <MetaRow label="driver" value={data.gpu.driver ?? 'none'} />
              <MetaRow label="devices" value={data.gpu.gpuCount} />
              <MetaRow label="last poll" value={formatAge(data.gpu.ageMs)} />
            </SystemPanel>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <SystemPanel title="Runtime">
              <MetaRow label="uptime" value={formatUptime(data.runtime.uptimeSec)} />
              <MetaRow label="node" value={data.runtime.nodeVersion} />
              <MetaRow label="commit" value={data.runtime.gitCommit} />
            </SystemPanel>
            <SystemPanel title="Database">
              <MetaRow label="path" value={<span className="break-all">{data.database.path}</span>} />
              <MetaRow label="special" value={data.database.specialPath ? 'yes' : 'no'} />
            </SystemPanel>
          </div>
        </div>
      </main>
    </div>
  )
}
