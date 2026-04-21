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
    <section className="panel !rounded-none !border-x-0 !bg-surface-1 px-4 py-4 max-[1100px]:border-r max-[1100px]:border-r-[color:color-mix(in_srgb,var(--border)_86%,transparent)] max-[900px]:border-r-0">
      <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.12em] text-fg-dim">Upstream</div>
      <dl className="grid gap-2">
        <div>
          <dt>host</dt>
          <dd className="mono">{upstream?.reachable ? upstream.host : '—'}</dd>
        </div>
        <div>
          <dt>version</dt>
          <dd className="mono">{upstream?.reachable ? `v${upstream.version}` : '—'}</dd>
        </div>
        <div>
          <dt>/health</dt>
          <dd className="inline-flex items-center gap-1.5 mono">
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
              <dl className="grid gap-2">
                <div>
                  <dt>device</dt>
                  <dd className="mono">{gpuEntry.name}</dd>
                </div>
                {gpuEntry.memoryTotalMiB != null ? (
                  <div>
                    <dt>vram</dt>
                    <dd className="mono inline-flex items-center justify-between gap-2">
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
                ) : null}
                <div>
                  <dt>util · temp</dt>
                  <dd className="mono">
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
