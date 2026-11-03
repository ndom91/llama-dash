import { seriesVar } from '../../lib/series-color'

export function DashboardModelsLegend() {
  return (
    <div
      className="flex flex-wrap items-center gap-x-5 gap-y-1 px-4 py-2.5 font-mono text-[10px] text-fg-dim"
      aria-hidden="true"
    >
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-2 w-3.5 rounded-[2px]" style={{ background: seriesVar(0) }} />
        resident
      </span>
      <span className="flex items-center gap-1.5">
        <span className="residency-span-loading inline-block h-2 w-3.5 rounded-[2px]" />
        loading
      </span>
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-2.5 w-px bg-fg" />
        request
      </span>
      <span className="flex items-center gap-1.5">
        <span className="inline-block w-3.5 border-t border-dashed border-fg-faint" />
        peer — residency not reported, requests only
      </span>
    </div>
  )
}
