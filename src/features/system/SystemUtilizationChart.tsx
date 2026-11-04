import type { ApiSystemTelemetry } from '../../lib/schemas/system'
import { rangeXLabels, swapBands } from './systemChartAxis'
import { formatPercent } from './systemMetrics'
import { SystemChartPanel } from './SystemChartPanel'
import { TimeSeriesChart } from './TimeSeriesChart'

const GPU_COLOR = 'var(--series-1)'
const CPU_COLOR = 'var(--series-3)'

export function SystemUtilizationChart({
  telemetry,
  fromMs,
  toMs,
}: {
  telemetry: ApiSystemTelemetry
  fromMs: number
  toMs: number
}) {
  return (
    <SystemChartPanel
      title="Utilization"
      aside={`${telemetry.range} · ${telemetry.intervalMs / 1000}s samples`}
      legend={[
        { label: 'gpu', color: GPU_COLOR },
        { label: 'cpu', color: CPU_COLOR },
        { label: 'model load', color: 'var(--fg-faint)', band: true },
      ]}
    >
      <TimeSeriesChart
        t={telemetry.series.t}
        series={[
          {
            id: 'gpu',
            label: 'gpu',
            values: telemetry.series.gpuUtil,
            color: GPU_COLOR,
            format: formatPercent,
            area: true,
          },
          { id: 'cpu', label: 'cpu', values: telemetry.series.cpu, color: CPU_COLOR, format: formatPercent },
        ]}
        fromMs={fromMs}
        toMs={toMs}
        domain={[0, 100]}
        height={150}
        bands={swapBands(telemetry.swaps)}
        yTicks={[0, 25, 50, 75, 100]}
        xLabels={rangeXLabels(telemetry.range)}
      />
    </SystemChartPanel>
  )
}
