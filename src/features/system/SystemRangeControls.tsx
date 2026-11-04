import { SegmentedControl } from '../../components/SegmentedControl'
import { StatusDot } from '../../components/StatusDot'
import { SYSTEM_TELEMETRY_RANGES, type SystemTelemetryRange } from '../../lib/schemas/system'

const RANGE_OPTIONS = SYSTEM_TELEMETRY_RANGES.map((range) => ({ value: range, label: range }))

export function SystemRangeControls({
  range,
  onRangeChange,
  intervalMs,
}: {
  range: SystemTelemetryRange
  onRangeChange: (range: SystemTelemetryRange) => void
  intervalMs: number
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-fg-dim">
        <StatusDot tone="ok" live />
        live · {intervalMs / 1000}s
      </span>
      <SegmentedControl legend="Telemetry range" options={RANGE_OPTIONS} value={range} onChange={onRangeChange} />
    </div>
  )
}
