import { useNavigate, useSearch } from '@tanstack/react-router'
import { PageHeader } from '../../components/PageHeader'
import { useHealth, useModels, useSystemStatus, useSystemTelemetry, useSystemThresholds } from '../../lib/queries'
import {
  type ApiSystemStatus,
  type ApiSystemTelemetry,
  SYSTEM_TELEMETRY_RANGE_MS,
  type SystemTelemetryRange,
} from '../../lib/schemas/system'
import type { SystemThresholds } from '../../lib/schemas/system-thresholds'
import { InferenceHostPanel } from './InferenceHostPanel'
import { SystemBackendPanel } from './SystemBackendPanel'
import { type SystemComponentRow, SystemComponentsRail } from './SystemComponentsRail'
import { SystemControlBusPanel } from './SystemControlBusPanel'
import { SystemCpuCoresPanel } from './SystemCpuCoresPanel'
import { SystemEventsPanel } from './SystemEventsPanel'
import { SystemRangeControls } from './SystemRangeControls'
import { SystemResourceTiles } from './SystemResourceTiles'
import { SystemRuntimePanel } from './SystemRuntimePanel'
import { SystemThermalsChart } from './SystemThermalsChart'
import { SystemThresholdsPanel } from './SystemThresholdsPanel'
import { SystemUnifiedMemoryPanel } from './SystemUnifiedMemoryPanel'
import { SystemUtilizationChart } from './SystemUtilizationChart'
import {
  breachTone,
  evaluateBreaches,
  formatAge,
  formatBytesShort,
  formatUptime,
  systemReadings,
  type Tone,
} from './systemMetrics'

const DEFAULT_RANGE: SystemTelemetryRange = '15m'
// Uptime, queue counts and DB size are not pushed over SSE, so refresh them while this page is open.
const STATUS_REFRESH_MS = 30_000
const HEADER_COPY = {
  kicker: 'sys · system',
  title: 'System',
  subtitle: 'Resource telemetry, process health, control-bus state, and database posture.',
} as const

function worstTone(tones: Array<Tone>): Tone {
  if (tones.includes('err')) return 'err'
  if (tones.includes('warn')) return 'warn'
  return 'ok'
}

function backendTone(reachable: boolean | undefined): Tone {
  if (reachable == null) return 'idle'
  return reachable ? 'ok' : 'err'
}

function gpuTelemetryDetail(status: ApiSystemStatus, temperatureC: number | null): string {
  if (temperatureC != null) return `${temperatureC}°C`
  return status.gpu.available ? 'live' : 'offline'
}

function componentRows(
  status: ApiSystemStatus,
  telemetry: ApiSystemTelemetry | undefined,
  thresholds: SystemThresholds | undefined,
  backendReachable: boolean | undefined,
): Array<SystemComponentRow> {
  const breached = evaluateBreaches(systemReadings(status, telemetry), thresholds)
  const gpu = status.gpu.available ? (status.gpu.gpus[0] ?? null) : null
  const latestAt = telemetry?.latest?.timestamp ?? null
  return [
    {
      label: 'resources',
      detail: latestAt == null ? 'waiting' : formatAge(Date.now() - latestAt),
      tone: worstTone(
        (['gpuTempC', 'gpuMemPercent', 'ramPercent', 'cpuPercent'] as const).map((metric) =>
          breachTone(metric, breached),
        ),
      ),
    },
    { label: 'control bus', detail: 'now', tone: 'ok' },
    {
      label: 'backend',
      detail: status.inference.label,
      tone: backendTone(backendReachable),
    },
    {
      label: 'log queue',
      detail: `${status.logging.queued} · ${status.logging.dropped > 0 ? 'dropping' : 'ready'}`,
      tone: breachTone('queueDropped', breached),
    },
    {
      label: 'gpu telemetry',
      detail: gpuTelemetryDetail(status, gpu?.temperatureC ?? null),
      tone: status.gpu.available ? breachTone('gpuTempC', breached) : 'idle',
    },
    {
      label: 'database',
      detail: status.database.sizeBytes == null ? 'file' : formatBytesShort(status.database.sizeBytes),
      tone: 'ok',
    },
    { label: 'runtime', detail: formatUptime(status.runtime.uptimeSec), tone: 'ok' },
  ]
}

export function SystemPage() {
  const search = useSearch({ from: '/system' })
  const navigate = useNavigate({ from: '/system' })
  const range = search.range ?? DEFAULT_RANGE

  const { data: status, isLoading, error } = useSystemStatus({ refetchIntervalMs: STATUS_REFRESH_MS })
  const { data: telemetry } = useSystemTelemetry(range)
  const { data: thresholds } = useSystemThresholds()
  const { data: health } = useHealth()
  const { data: models = [] } = useModels()

  const setRange = (next: SystemTelemetryRange) => {
    void navigate({ search: { range: next === DEFAULT_RANGE ? undefined : next }, replace: true })
  }

  const controls = (
    <SystemRangeControls range={range} onRangeChange={setRange} intervalMs={telemetry?.intervalMs ?? 10_000} />
  )

  if (isLoading || error || !status) {
    return (
      <div className="content">
        <PageHeader {...HEADER_COPY} variant="integrated" />
        <main className="flex-1 p-4">
          {error ? (
            <div className="panel p-4 text-sm text-danger">Failed to load system status.</div>
          ) : (
            <div className="panel h-64 animate-pulse bg-surface-2" />
          )}
        </main>
      </div>
    )
  }

  const toMs = telemetry?.series.t.at(-1) ?? telemetry?.latest?.timestamp ?? Date.now()
  const fromMs = toMs - SYSTEM_TELEMETRY_RANGE_MS[range]
  const readings = systemReadings(status, telemetry)
  const breached = evaluateBreaches(readings, thresholds)

  return (
    <div className="content">
      <div className="page min-h-full px-0">
        <PageHeader {...HEADER_COPY} action={controls} variant="integrated" />
        <div className="flex min-h-0 flex-1">
          <SystemComponentsRail components={componentRows(status, telemetry, thresholds, health?.upstream.reachable)}>
            <SystemThresholdsPanel thresholds={thresholds} />
          </SystemComponentsRail>
          <main className="flex min-h-0 flex-1 flex-col overflow-y-auto">
            {telemetry ? (
              <>
                <SystemResourceTiles
                  status={status}
                  telemetry={telemetry}
                  thresholds={thresholds}
                  breached={breached}
                  readings={readings}
                  residentModels={models.filter((model) => model.kind === 'local' && model.running).length}
                  fromMs={fromMs}
                  toMs={toMs}
                />
                <div className="grid border-t border-border xl:grid-cols-2">
                  <SystemUtilizationChart telemetry={telemetry} fromMs={fromMs} toMs={toMs} />
                  <SystemThermalsChart
                    telemetry={telemetry}
                    fromMs={fromMs}
                    toMs={toMs}
                    tempThreshold={thresholds?.gpuTempC ?? null}
                    className="border-border max-xl:border-t xl:border-l"
                  />
                </div>
              </>
            ) : (
              <div className="h-80 animate-pulse border-b border-border bg-surface-1" />
            )}
            <SystemUnifiedMemoryPanel status={status} latest={telemetry?.latest ?? null} models={models} />
            <div className="grid flex-1 md:grid-cols-2 xl:grid-cols-3 [&>*]:border-border md:[&>*:nth-child(even)]:border-l xl:[&>*:not(:nth-child(3n+1))]:border-l xl:[&>*:nth-child(even):nth-child(3n+1)]:border-l-0">
              <SystemControlBusPanel status={status} />
              <SystemBackendPanel
                status={status}
                version={health?.upstream.reachable ? (health.upstream.version ?? null) : null}
                queueTone={breachTone('queueDropped', breached)}
              />
              <SystemEventsPanel events={telemetry?.events ?? []} />
              <InferenceHostPanel hardware={status.inferenceHardware} />
              <SystemCpuCoresPanel latest={telemetry?.latest ?? null} />
              <SystemRuntimePanel status={status} />
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}
