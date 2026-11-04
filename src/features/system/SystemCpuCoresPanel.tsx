import type { SystemTelemetryLatest } from '../../lib/schemas/system'
import { MetaRow } from './MetaRow'
import { SystemPanel } from './SystemPanel'
import { formatBytesShort } from './systemMetrics'

export function SystemCpuCoresPanel({ latest }: { latest: SystemTelemetryLatest | null }) {
  const cores = latest?.cpuPerCore ?? []
  return (
    <SystemPanel title="CPU Cores" aside="now">
      {cores.length === 0 ? (
        <p className="m-0 py-2 font-mono text-[11px] text-fg-faint">per-core data unavailable</p>
      ) : (
        <div className="grid gap-1 [grid-template-columns:repeat(auto-fit,minmax(18px,1fr))]">
          {cores.map((value, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: core index is the identity
            <div key={index} className="flex flex-col items-center gap-1">
              <div className="relative h-10 w-full overflow-hidden rounded-sm border border-border bg-surface-2">
                <div
                  className="absolute inset-x-0 bottom-0 bg-[var(--series-3)] transition-[height] duration-300 ease-out"
                  style={{ height: `${Math.min(100, value)}%` }}
                />
              </div>
              <span className="font-mono text-[9px] tabular-nums text-fg-faint">{index}</span>
            </div>
          ))}
        </div>
      )}
      {latest ? (
        <dl className="m-0 mt-3">
          <MetaRow
            label="llama-dash process"
            value={`${latest.process.cpuPercent.toFixed(1)}% · ${formatBytesShort(latest.process.rssBytes)}`}
          />
        </dl>
      ) : null}
    </SystemPanel>
  )
}
