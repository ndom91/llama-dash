import type { ApiSystemTelemetry } from '../../lib/schemas/system'
import { cn } from '../../lib/cn'
import { rangeXLabels } from './systemChartAxis'
import { SystemChartPanel } from './SystemChartPanel'
import { TimeSeriesChart } from './TimeSeriesChart'

const TEMP_COLOR = 'var(--series-2)'
const POWER_COLOR = 'var(--series-4)'

function maxOf(values: Array<number | null>): number {
  return values.reduce<number>((max, value) => (value != null && value > max ? value : max), 0)
}

export function SystemThermalsChart({
  telemetry,
  fromMs,
  toMs,
  tempThreshold,
  className,
}: {
  telemetry: ApiSystemTelemetry
  fromMs: number
  toMs: number
  tempThreshold: number | null
  className?: string
}) {
  // Temperature and power share one axis; scale it to fit both plus the threshold line.
  const top = Math.max(100, Math.ceil(Math.max(maxOf(telemetry.series.gpuPower), tempThreshold ?? 0) / 20) * 20 + 20)
  const hasData = telemetry.series.gpuTemp.some((value) => value != null)

  return (
    <SystemChartPanel
      title="Thermals & Power"
      aside={telemetry.range}
      className={cn(className)}
      legend={[
        { label: 'temp °C', color: TEMP_COLOR },
        { label: 'power W', color: POWER_COLOR },
        ...(tempThreshold != null ? [{ label: `${tempThreshold}°C limit`, color: 'var(--fg-dim)', dashed: true }] : []),
      ]}
    >
      {hasData ? (
        <TimeSeriesChart
          t={telemetry.series.t}
          series={[
            { id: 'temp', values: telemetry.series.gpuTemp, color: TEMP_COLOR },
            { id: 'power', values: telemetry.series.gpuPower, color: POWER_COLOR },
          ]}
          fromMs={fromMs}
          toMs={toMs}
          domain={[0, top]}
          height={150}
          thresholdLine={tempThreshold}
          yTicks={[0, Math.round(top / 4), Math.round(top / 2), Math.round((top * 3) / 4), top]}
          xLabels={rangeXLabels(telemetry.range)}
        />
      ) : (
        <div className="flex h-[150px] items-center justify-center font-mono text-[11px] text-fg-faint">
          no gpu sensor data on this host
        </div>
      )}
    </SystemChartPanel>
  )
}
