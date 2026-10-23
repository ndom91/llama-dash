import { Cpu, Gauge, MemoryStick } from 'lucide-react'
import { useGpu } from '../lib/queries'
import { Tooltip } from './Tooltip'

const clampPercent = (value: number | null | undefined) => Math.min(Math.max(value ?? 0, 0), 100)

export function CollapsedSidebarMetrics() {
  const { data: gpu } = useGpu()
  const gpuCard = gpu?.available ? gpu.gpus[0] : null
  const metrics = [
    {
      label: 'VRAM',
      value: gpuCard?.memoryPercent ?? null,
      Icon: MemoryStick,
    },
    {
      label: 'CPU',
      value: gpu?.cpuUtilizationPercent ?? null,
      Icon: Cpu,
    },
    {
      label: 'GPU',
      value: gpuCard?.utilizationPercent ?? null,
      Icon: Gauge,
    },
  ]

  return (
    <div className="mb-3 hidden shrink-0 flex-col items-center gap-2 border-t border-border pt-3 md:flex">
      {metrics.map(({ label, value, Icon }) => {
        const percent = clampPercent(value)
        const reading = value == null ? 'unavailable' : `${Math.round(percent)}%`
        return (
          <Tooltip key={label} label={`${label} · ${reading}`} side="right">
            <div
              className="flex size-6 items-center justify-center rounded-full p-0.5"
              style={{
                background:
                  value == null
                    ? 'var(--bg-4)'
                    : `conic-gradient(var(--accent) ${percent}%, var(--bg-4) ${percent}% 100%)`,
              }}
            >
              <div className="flex size-full items-center justify-center rounded-full bg-surface-0 text-fg-dim">
                <Icon className="size-3" strokeWidth={1.75} aria-hidden="true" />
                <span className="sr-only">{`${label} utilization: ${reading}`}</span>
              </div>
            </div>
          </Tooltip>
        )
      })}
    </div>
  )
}
