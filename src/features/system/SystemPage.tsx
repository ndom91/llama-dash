import { PageHeader } from '../../components/PageHeader'
import { StatusDot } from '../../components/StatusDot'
import { TopBar } from '../../components/TopBar'
import { cn } from '../../lib/cn'
import { useSystemStatus } from '../../lib/queries'

type Tone = 'ok' | 'warn' | 'err' | 'idle'

function formatAge(ms: number | null): string {
  if (ms == null) return 'never'
  if (ms < 1_000) return `${ms}ms ago`
  return `${Math.round(ms / 1_000)}s ago`
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86_400)
  const hours = Math.floor((seconds % 86_400) / 3_600)
  const minutes = Math.floor((seconds % 3_600) / 60)
  return [days > 0 ? `${days}d` : null, hours > 0 || days > 0 ? `${hours}h` : null, `${minutes}m`]
    .filter(Boolean)
    .join(' ')
}

function MetaRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid items-center gap-3 border-b border-border/45 py-1.5 last:border-b-0 [grid-template-columns:120px_minmax(0,1fr)]">
      <dt className="font-mono text-[10px] lowercase tracking-[0.04em] text-fg-dim">{label}</dt>
      <dd className="m-0 min-w-0 justify-self-end text-right font-mono text-xs text-fg">{value}</dd>
    </div>
  )
}

function SystemPanel({
  title,
  aside,
  children,
  className,
}: {
  title: string
  aside?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={cn('panel overflow-hidden p-3', className)}>
      <div className="mb-1.5 flex items-center gap-2 border-b border-border/55 pb-1.5">
        <h2 className="m-0 font-mono text-[10px] uppercase tracking-[0.14em] text-fg-faint">
          <span className="text-accent">—</span> {title}
        </h2>
        {aside ? <div className="ml-auto font-mono text-[10px] text-accent">{aside}</div> : null}
      </div>
      <dl className="m-0">{children}</dl>
    </section>
  )
}

function StatTile({ label, value, meta, tone }: { label: string; value: React.ReactNode; meta?: string; tone: Tone }) {
  return (
    <section className="panel min-w-0 p-3">
      <div className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-fg-faint">
        <StatusDot tone={tone} /> {label}
      </div>
      <div className="truncate font-mono text-lg font-semibold text-fg">{value}</div>
      {meta ? <div className="mt-1 truncate font-mono text-[10px] text-fg-dim">{meta}</div> : null}
    </section>
  )
}

function ComponentRail({ components }: { components: Array<{ label: string; age: string; tone: Tone }> }) {
  return (
    <aside className="hidden w-[220px] shrink-0 border-r border-border bg-surface-0/70 xl:block">
      <div className="flex items-center border-b border-border px-3 py-3 font-mono text-[10px] uppercase tracking-[0.14em] text-fg-faint">
        <span>components</span>
        <span className="ml-auto">all</span>
      </div>
      <div className="p-2">
        {components.map((item) => (
          <div
            key={item.label}
            className="grid items-center gap-2 border-b border-border/35 px-2 py-2 last:border-b-0 [grid-template-columns:12px_minmax(0,1fr)_auto]"
          >
            <StatusDot tone={item.tone} />
            <span className="truncate font-mono text-[11px] text-fg-muted">{item.label}</span>
            <span className="font-mono text-[10px] text-fg-faint">{item.age}</span>
          </div>
        ))}
      </div>
    </aside>
  )
}

function DirectTargets({ targets }: { targets: string[] }) {
  return (
    <div className="mt-3 flex flex-col items-end gap-2">
      <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-fg-faint">
        whitelisted direct upstream hosts
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        {targets.map((target) => (
          <span
            key={target}
            className="rounded border border-border/70 bg-surface-2 px-2 py-1 font-mono text-[10px] text-fg-dim"
          >
            {target.replace('https://', '')}
          </span>
        ))}
      </div>
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

  const queueTone: Tone = data.logging.dropped > 0 ? 'err' : data.logging.queued > 0 ? 'warn' : 'ok'
  const gpuTone: Tone = data.gpu.available ? 'ok' : 'idle'
  const primaryGpu = data.gpu.gpus[0] ?? null
  const components = [
    { label: 'control bus', age: 'now', tone: 'ok' as const },
    { label: 'logging queue', age: 'live', tone: queueTone },
    { label: 'gpu poller', age: formatAge(data.gpu.ageMs), tone: gpuTone },
    { label: 'database', age: data.database.specialPath ? 'special' : 'file', tone: 'ok' as const },
    { label: 'runtime', age: formatUptime(data.runtime.uptimeSec), tone: 'ok' as const },
  ]

  return (
    <div className="main-col">
      <TopBar />
      <div className="content">
        <div className="page min-h-full px-0">
          <PageHeader
            kicker="sys · system"
            title="System"
            subtitle="Process health, control-bus state, GPU pollers, and database posture."
            variant="integrated"
          />
          <div className="flex min-h-0 flex-1">
            <ComponentRail components={components} />
            <main className="min-h-0 flex-1 overflow-y-auto p-3">
              <div className="mx-auto flex max-w-7xl flex-col gap-3">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <StatTile
                    label="runtime"
                    value={formatUptime(data.runtime.uptimeSec)}
                    meta={data.runtime.nodeVersion}
                    tone="ok"
                  />
                  <StatTile
                    label="queue"
                    value={data.logging.queued}
                    meta={`${data.logging.dropped} dropped · live`}
                    tone={queueTone}
                  />
                  <StatTile
                    label="gpu"
                    value={data.gpu.driver ?? 'offline'}
                    meta={`${data.gpu.gpuCount} device · ${formatAge(data.gpu.ageMs)}`}
                    tone={gpuTone}
                  />
                  <StatTile
                    label="proxy"
                    value={data.proxy.upstreamHost}
                    meta={data.proxy.insecureTls ? 'insecure tls' : 'tls normal'}
                    tone="ok"
                  />
                </div>

                <SystemPanel title="Control Bus" aside="configured">
                  <MetaRow label="upstream" value={<span className="break-all">{data.proxy.upstreamBaseUrl}</span>} />
                  <MetaRow label="host" value={data.proxy.upstreamHost} />
                  <MetaRow label="auth" value={data.proxy.insecureTls ? 'insecure tls enabled' : 'standard tls'} />
                  <MetaRow label="metrics" value="/metrics" />
                  <MetaRow label="direct targets" value={data.proxy.directTargets.length} />
                  <DirectTargets targets={data.proxy.directTargets} />
                </SystemPanel>

                <div className="grid gap-3 xl:grid-cols-2">
                  <SystemPanel title="Loading Queue" aside={data.logging.dropped > 0 ? 'dropping' : 'ready'}>
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

                  <SystemPanel title="GPU Poller" aside={`${data.gpu.gpuCount} device`}>
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
                    {primaryGpu ? <MetaRow label="device" value={primaryGpu.name} /> : null}
                    {primaryGpu?.cores != null ? <MetaRow label="cores" value={primaryGpu.cores} /> : null}
                    {primaryGpu?.memoryUsedMiB != null && primaryGpu.memoryTotalMiB != null ? (
                      <MetaRow
                        label={data.gpu.driver === 'apple' ? 'unified memory' : 'memory'}
                        value={`${(primaryGpu.memoryUsedMiB / 1024).toFixed(1)} / ${(primaryGpu.memoryTotalMiB / 1024).toFixed(1)} GiB`}
                      />
                    ) : null}
                    {primaryGpu?.memoryPercent != null ? (
                      <MetaRow label="memory used" value={`${primaryGpu.memoryPercent}%`} />
                    ) : null}
                    {primaryGpu?.utilizationPercent != null ? (
                      <MetaRow label="utilization" value={`${primaryGpu.utilizationPercent}%`} />
                    ) : null}
                    {primaryGpu?.temperatureC != null ? (
                      <MetaRow label="temperature" value={`${primaryGpu.temperatureC}°C`} />
                    ) : null}
                    {primaryGpu?.powerW != null ? <MetaRow label="power" value={`${primaryGpu.powerW} W`} /> : null}
                    <MetaRow label="last poll" value={formatAge(data.gpu.ageMs)} />
                  </SystemPanel>
                </div>

                <div className="grid gap-3 xl:grid-cols-2">
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
        </div>
      </div>
    </div>
  )
}
