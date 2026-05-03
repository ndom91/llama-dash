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
  if (days === 0 && hours === 0 && minutes === 0) return `${Math.max(1, Math.floor(seconds))}s`
  return [days > 0 ? `${days}d` : null, hours > 0 || days > 0 ? `${hours}h` : null, `${minutes}m`]
    .filter(Boolean)
    .join(' ')
}

function MetaRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid items-center gap-4 border-b border-dashed border-border/55 py-1.5 last:border-b-0 [grid-template-columns:130px_minmax(0,1fr)]">
      <dt className="font-mono text-[11px] lowercase tracking-[0.02em] text-fg-muted">{label}</dt>
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
    <section className={cn('panel !rounded-none border-x-0 !bg-surface-1', className)}>
      <div className="panel-head bg-transparent px-6 max-md:px-4">
        <h2 className="panel-title">{title}</h2>
        {aside ? <span className="panel-sub ml-auto">· {aside}</span> : null}
      </div>
      <dl className="m-0 px-6 py-4 max-md:px-4">{children}</dl>
    </section>
  )
}

function StatTile({ label, value, meta, tone }: { label: string; value: React.ReactNode; meta?: string; tone: Tone }) {
  return (
    <section className="min-w-0 border border-border bg-surface-1 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.025)]">
      <div className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-fg-faint">
        <StatusDot tone={tone} /> {label}
      </div>
      <div className="truncate font-mono text-xl font-semibold tracking-[-0.04em] text-fg">{value}</div>
      {meta ? <div className="mt-1 truncate font-mono text-[10px] text-fg-dim">{meta}</div> : null}
    </section>
  )
}

function ComponentRail({ components }: { components: Array<{ label: string; age: string; tone: Tone }> }) {
  return (
    <aside className="hidden w-[232px] shrink-0 border-r border-border bg-surface-0/70 xl:block">
      <div className="flex h-12 items-center border-b border-border px-4 font-mono text-[10px] uppercase tracking-[0.18em] text-fg-faint">
        <span>components</span>
        <span className="ml-auto">all</span>
      </div>
      <div className="py-2">
        {components.map((item) => (
          <div
            key={item.label}
            className="grid items-center gap-2 border-l-2 border-transparent px-4 py-2.5 first:border-l-accent first:bg-surface-2/65 [grid-template-columns:12px_minmax(0,1fr)_auto]"
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
    <div className="mt-3 flex flex-col items-end gap-2 border-t border-border/45 pt-3">
      <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-fg-faint">
        whitelisted direct upstream hosts
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        {targets.map((target) => (
          <span
            key={target}
            className="border border-border/70 bg-surface-2 px-2 py-1 font-mono text-[10px] text-fg-dim"
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
    { label: 'backend', age: data.inference.label, tone: 'ok' as const },
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
            <main className="min-h-0 flex flex-col flex-1 overflow-y-auto">
              <div className="flex flex-col flex-1">
                <div className="grid gap-3 border-b border-border bg-surface-0 px-6 py-5 md:grid-cols-2 xl:grid-cols-4 max-md:px-4">
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
                    meta={`${data.inference.label} · ${data.proxy.insecureTls ? 'insecure tls' : 'tls normal'}`}
                    tone="ok"
                  />
                </div>

                <SystemPanel title="Control Bus" aside="configured" className="!border-t-0">
                  <MetaRow label="backend" value={data.inference.label} />
                  <MetaRow label="upstream" value={<span className="break-all">{data.proxy.upstreamBaseUrl}</span>} />
                  <MetaRow label="host" value={data.proxy.upstreamHost} />
                  <MetaRow label="auth" value={data.proxy.insecureTls ? 'insecure tls enabled' : 'standard tls'} />
                  <MetaRow label="metrics" value="/metrics" />
                  <MetaRow label="direct targets" value={data.proxy.directTargets.length} />
                  <DirectTargets targets={data.proxy.directTargets} />
                </SystemPanel>

                <SystemPanel title="Inference Backend" aside={data.inference.kind}>
                  <MetaRow label="runtime" value={data.inference.label} />
                  <MetaRow label="models" value={data.inference.capabilities.models ? 'supported' : 'unsupported'} />
                  <MetaRow
                    label="running"
                    value={data.inference.capabilities.runningModels ? 'supported' : 'unsupported'}
                  />
                  <MetaRow
                    label="lifecycle"
                    value={data.inference.capabilities.lifecycle ? 'supported' : 'unsupported'}
                  />
                  <MetaRow label="logs" value={data.inference.capabilities.logs ? 'supported' : 'unsupported'} />
                  <MetaRow label="config" value={data.inference.capabilities.config ? 'supported' : 'unsupported'} />
                </SystemPanel>

                <div className="grid border-t border-border xl:grid-cols-2">
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

                  <SystemPanel title="GPU Poller" aside={`${data.gpu.gpuCount} device`} className="xl:border-l">
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

                <div className="grid border-t border-border xl:grid-cols-2 flex-1">
                  <SystemPanel title="Runtime">
                    <MetaRow label="uptime" value={formatUptime(data.runtime.uptimeSec)} />
                    <MetaRow label="node" value={data.runtime.nodeVersion} />
                    <MetaRow label="commit" value={data.runtime.gitCommit} />
                  </SystemPanel>

                  <SystemPanel title="Database" className="xl:border-l">
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
