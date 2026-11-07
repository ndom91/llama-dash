import type { ApiSystemStatus, ApiSystemTelemetry } from '../../lib/schemas/system'
import type { SystemThresholds, ThresholdMetric } from '../../lib/schemas/system-thresholds'
import { SystemResourceTile } from './SystemResourceTile'
import {
  breachTone,
  formatClock,
  formatGiB,
  formatPercent,
  lastValue,
  mibToBytes,
  peak,
  type SystemReadings,
} from './systemMetrics'

function formatMiBAsGiB(value: number): string {
  return `${formatGiB(mibToBytes(value))} GiB`
}

function gpuMemoryKind(driver: ApiSystemStatus['gpu']['driver']): string {
  switch (driver) {
    case 'amd':
      return 'GTT'
    case 'apple':
      return 'unified'
    default:
      return 'VRAM'
  }
}

export function SystemResourceTiles({
  status,
  telemetry,
  thresholds,
  breached,
  readings,
  residentModels,
  fromMs,
  toMs,
}: {
  status: ApiSystemStatus
  telemetry: ApiSystemTelemetry
  thresholds: SystemThresholds | undefined
  breached: Set<ThresholdMetric>
  readings: SystemReadings
  residentModels: number
  fromMs: number
  toMs: number
}) {
  const { series, latest } = telemetry
  const gpu = status.gpu.available ? (status.gpu.gpus[0] ?? null) : null
  const cpu = lastValue(series.cpu)
  const gpuUtil = gpu?.utilizationPercent ?? lastValue(series.gpuUtil)
  const gpuPeak = peak(series, 'gpuUtil')
  const gpuMemPercent = readings.gpuMemPercent
  const ramPercent = readings.ramPercent
  const shared = { t: series.t, fromMs, toMs }

  const gpuMeta = [
    gpu?.temperatureC != null ? `${gpu.temperatureC}°C` : null,
    gpu?.powerW != null ? `${gpu.powerW} W` : null,
    gpuPeak ? `peak ${Math.round(gpuPeak.value)}% @ ${formatClock(gpuPeak.t).slice(0, 5)}` : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <div className="grid min-w-0 grid-cols-1 gap-3 px-6 py-5 md:grid-cols-2 xl:grid-cols-4 max-md:px-4">
      <SystemResourceTile
        {...shared}
        label="cpu"
        aside={latest?.cpuPerCore.length ? `${latest.cpuPerCore.length} logical` : undefined}
        value={cpu == null ? '—' : Math.round(cpu)}
        unit="%"
        meta={latest?.loadAvg ? `load ${latest.loadAvg.map((value) => value.toFixed(2)).join(' · ')}` : null}
        percent={cpu}
        thresholdPercent={thresholds?.cpuPercent}
        tone={breachTone('cpuPercent', breached)}
        values={series.cpu}
        domain={[0, 100]}
        formatValue={formatPercent}
      />
      <SystemResourceTile
        {...shared}
        label="gpu"
        aside={gpu ? [gpu.name, gpu.cores != null ? `${gpu.cores} CU` : null].filter(Boolean).join(' · ') : 'offline'}
        value={gpuUtil == null ? '—' : Math.round(gpuUtil)}
        unit="%"
        meta={gpuMeta}
        percent={gpuUtil}
        // The GPU tile's state is thermal: utilization near 100% is the point of the hardware.
        tone={gpu ? breachTone('gpuTempC', breached) : 'idle'}
        values={series.gpuUtil}
        domain={[0, 100]}
        formatValue={formatPercent}
      />
      <SystemResourceTile
        {...shared}
        label="gpu memory"
        aside={gpuMemoryKind(status.gpu.driver)}
        value={gpu?.memoryUsedMiB == null ? '—' : formatGiB(mibToBytes(gpu.memoryUsedMiB))}
        unit={gpu?.memoryTotalMiB == null ? undefined : `/ ${formatGiB(mibToBytes(gpu.memoryTotalMiB))} GiB`}
        meta={
          gpuMemPercent == null || gpu?.memoryTotalMiB == null || gpu.memoryUsedMiB == null
            ? null
            : `${Math.round(gpuMemPercent)}% · ${residentModels} ${residentModels === 1 ? 'model' : 'models'} resident · ${formatGiB(mibToBytes(gpu.memoryTotalMiB - gpu.memoryUsedMiB))} GiB free`
        }
        percent={gpuMemPercent}
        thresholdPercent={thresholds?.gpuMemPercent}
        tone={gpu ? breachTone('gpuMemPercent', breached) : 'idle'}
        values={series.gpuMemUsedMiB}
        domain={[0, gpu?.memoryTotalMiB ?? lastValue(series.gpuMemTotalMiB) ?? 1]}
        formatValue={formatMiBAsGiB}
      />
      <SystemResourceTile
        {...shared}
        label="system ram"
        aside={latest ? `${formatGiB(latest.memTotalBytes)} GiB` : undefined}
        value={latest ? formatGiB(latest.memUsedBytes) : '—'}
        unit={latest ? `/ ${formatGiB(latest.memTotalBytes)} GiB` : undefined}
        meta={
          latest
            ? [
                ramPercent == null ? null : `${Math.round(ramPercent)}%`,
                latest.pageCacheBytes == null ? null : `cache ${formatGiB(latest.pageCacheBytes)} GiB`,
                latest.swapUsedBytes == null ? null : `swap ${formatGiB(latest.swapUsedBytes)} GiB`,
              ]
                .filter(Boolean)
                .join(' · ')
            : null
        }
        percent={ramPercent}
        thresholdPercent={thresholds?.ramPercent}
        tone={latest ? breachTone('ramPercent', breached) : 'idle'}
        values={series.memUsedMiB}
        domain={[0, lastValue(series.memTotalMiB) ?? 1]}
        formatValue={formatMiBAsGiB}
      />
    </div>
  )
}
