import { cn } from '../../lib/cn'
import { formatClock } from './systemMetrics'

type TooltipRow = { id: string; label: string; color: string; value: number | null; format: (value: number) => string }

export function TimeSeriesTooltip({
  time,
  rows,
  notes,
  leftPercent,
  above,
}: {
  time: number
  rows: Array<TooltipRow>
  notes: Array<string>
  leftPercent: number
  /** Float above the plot; sparklines are too short to hold the box. */
  above: boolean
}) {
  return (
    <div
      className={cn(
        'llama-tooltip pointer-events-none absolute whitespace-nowrap font-mono',
        above ? 'bottom-full mb-1' : 'top-0',
        // Flip to the left of the crosshair in the right half so the box stays inside the chart.
        leftPercent > 50 ? '-translate-x-[calc(100%+10px)]' : 'translate-x-[10px]',
      )}
      style={{ left: `${leftPercent}%` }}
    >
      <div className="mb-1 text-[10px] text-[#9aa1a8]">{formatClock(time)}</div>
      {rows.map((row) => (
        <div key={row.id} className="flex items-center gap-2 text-[11px]">
          <span className="h-px w-2.5" style={{ background: row.color }} aria-hidden="true" />
          <span className="text-[#9aa1a8]">{row.label}</span>
          <span className="ml-auto pl-3 tabular-nums">{row.value == null ? '—' : row.format(row.value)}</span>
        </div>
      ))}
      {notes.map((note) => (
        <div key={note} className="mt-1 text-[10px] text-[#9aa1a8]">
          {note}
        </div>
      ))}
    </div>
  )
}
