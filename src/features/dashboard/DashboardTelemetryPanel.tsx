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
    <section className="panel dashboard-panel dashboard-telemetry-panel">
      <div className="dashboard-section-kicker">Upstream</div>
      <dl className="dashboard-kv-list">
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
          <dd className="mono dashboard-health-inline">
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
            <div key={`${gpuEntry.index}-${gpuEntry.name}`} className="dashboard-gpu-block">
              <div className="dashboard-section-kicker">{gpus.length > 1 ? `GPU ${index + 1}` : 'GPU'}</div>
              <dl className="dashboard-kv-list">
                <div>
                  <dt>device</dt>
                  <dd className="mono">{gpuEntry.name}</dd>
                </div>
                {gpuEntry.memoryTotalMiB != null ? (
                  <div>
                    <dt>vram</dt>
                    <dd className="mono dashboard-vram-row">
                      <span>
                        {formatMiBGb(gpuEntry.memoryUsedMiB)} / {formatMiBGb(gpuEntry.memoryTotalMiB)}
                      </span>
                      <span>GB</span>
                    </dd>
                    <div className="dashboard-vram-track">
                      <span className="dashboard-vram-fill" style={{ width: `${gpuEntry.memoryPercent ?? 0}%` }} />
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
