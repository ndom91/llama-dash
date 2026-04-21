import { StatusDot } from '../../components/StatusDot'
import type { ApiGpuSnapshot, ApiHealth } from '../../lib/api'
import { formatMiBGb } from './dashboardUtils'

type Props = {
  health: ApiHealth | undefined
  gpu: ApiGpuSnapshot | undefined
}

export function DashboardTelemetryPanel({ health, gpu }: Props) {
  const upstream = health?.upstream
  const gpus = gpu?.available ? gpu.gpus : []

  return (
    <section className="panel !rounded-none !border-x-0 !bg-surface-1 px-4 py-4 h-full">
      <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.12em] text-fg-dim">Upstream</div>
      <dl className="mb-3.5 mt-0 grid gap-[7px]">
        <div className="grid items-center gap-2" style={{ gridTemplateColumns: '70px 1fr' }}>
          <dt className="font-mono text-[10px] lowercase text-fg-dim">host</dt>
          <dd className="m-0 justify-self-end text-right font-mono text-[11px] leading-[1.35] whitespace-nowrap text-fg">
            {upstream?.reachable ? upstream.host : '—'}
          </dd>
        </div>
        <div className="grid items-center gap-2" style={{ gridTemplateColumns: '70px 1fr' }}>
          <dt className="font-mono text-[10px] lowercase text-fg-dim">version</dt>
          <dd className="m-0 justify-self-end text-right font-mono text-[11px] leading-[1.35] whitespace-nowrap text-fg">
            {upstream?.reachable ? `v${upstream.version}` : '—'}
          </dd>
        </div>
        <div className="grid items-center gap-2" style={{ gridTemplateColumns: '70px 1fr' }}>
          <dt className="font-mono text-[10px] lowercase text-fg-dim">/health</dt>
          <dd className="m-0 inline-flex items-center justify-self-end gap-1.5 text-right font-mono text-[11px] leading-[1.35] whitespace-nowrap text-fg">
            {upstream?.reachable ? (
              <>
                <StatusDot tone="ok" /> <span>ok · {upstream.latencyMs}ms</span>
              </>
            ) : (
              <>
                <StatusDot tone="err" /> <span>unreachable</span>
              </>
            )}
          </dd>
        </div>
      </dl>

      {gpus.length > 0
        ? gpus.map((gpuEntry, index) => (
            <div
              key={`${gpuEntry.index}-${gpuEntry.name}`}
              className="mt-4 border-t border-[color:color-mix(in_srgb,var(--border)_72%,transparent)] pt-4"
            >
              <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.12em] text-fg-dim">
                {gpus.length > 1 ? `GPU ${index + 1}` : 'GPU'}
              </div>
              <dl className="mb-0 mt-0 grid gap-[7px]">
                <div className="grid items-center gap-2" style={{ gridTemplateColumns: '70px 1fr' }}>
                  <dt className="font-mono text-[10px] lowercase text-fg-dim">device</dt>
                  <dd className="m-0 justify-self-end text-right font-mono text-[11px] leading-[1.35] whitespace-nowrap text-fg">
                    {gpuEntry.name}
                  </dd>
                </div>
                {gpuEntry.memoryTotalMiB != null ? (
                  <div className="grid items-start gap-2" style={{ gridTemplateColumns: '70px 1fr' }}>
                    <dt className="pt-0.5 font-mono text-[10px] lowercase text-fg-dim">vram</dt>
                    <div>
                      <dd className="m-0 inline-flex w-full items-center justify-between gap-2 font-mono text-[11px] leading-[1.35] whitespace-nowrap text-fg">
                        <span>
                          {formatMiBGb(gpuEntry.memoryUsedMiB)} / {formatMiBGb(gpuEntry.memoryTotalMiB)}
                        </span>
                        <span>GB</span>
                      </dd>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-3">
                        <span
                          className="block h-full rounded-full bg-accent"
                          style={{ width: `${gpuEntry.memoryPercent ?? 0}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ) : null}
                <div className="grid items-center gap-2" style={{ gridTemplateColumns: '70px 1fr' }}>
                  <dt className="font-mono text-[10px] lowercase text-fg-dim">util · temp</dt>
                  <dd className="m-0 justify-self-end text-right font-mono text-[11px] leading-[1.35] whitespace-nowrap text-fg">
                    {gpuEntry.utilizationPercent != null ? `${gpuEntry.utilizationPercent}%` : '—'}
                    {gpuEntry.temperatureC != null ? ` · ${gpuEntry.temperatureC}°C` : ''}
                  </dd>
                </div>
              </dl>
            </div>
          ))
        : null}
    </section>
  )
}
