import type { UsageDimension, UsagePanels } from '../../lib/api'
import { useUpdateUsagePanelSettings, useUsagePanelSettings } from '../../lib/queries'
import { USAGE_DIMENSIONS } from '../../lib/schemas/usage'
import { USAGE_DIMENSION_META } from '../usage/usageDimensions'

const SLOTS = [
  { id: 'usage-panel-1', label: 'Chart 1', hint: 'half width · left' },
  { id: 'usage-panel-2', label: 'Chart 2', hint: 'half width · right' },
  { id: 'usage-panel-3', label: 'Chart 3', hint: 'full width' },
] as const

export function UsagePanelSettingsForm() {
  const settings = useUsagePanelSettings()
  const update = useUpdateUsagePanelSettings()
  const panels = settings.data?.panels

  const choose = (slot: number, dimension: UsageDimension) => {
    if (!panels) return
    const next = [...panels] as UsagePanels
    next[slot] = dimension
    update.mutate({ panels: next })
  }

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {SLOTS.map((slot, i) => (
        <label
          key={slot.id}
          htmlFor={slot.id}
          className="flex flex-col gap-1.5 rounded border border-border bg-surface-2 p-3 font-mono text-[11px] text-fg-dim"
        >
          <span className="flex items-baseline justify-between gap-2">
            <span className="text-xs font-semibold text-fg">{slot.label}</span>
            <span className="text-fg-faint">{slot.hint}</span>
          </span>
          <select
            id={slot.id}
            className="select-native h-8 w-full cursor-pointer rounded border border-border-strong bg-surface-1 px-2.5 font-mono text-xs text-fg outline-none transition-[border-color,box-shadow] duration-100 focus:border-accent focus:[box-shadow:var(--shadow-focus)] disabled:cursor-not-allowed disabled:opacity-50"
            value={panels?.[i] ?? ''}
            disabled={!panels || update.isPending}
            onChange={(event) => choose(i, event.target.value as UsageDimension)}
          >
            {panels ? null : <option value="">loading…</option>}
            {USAGE_DIMENSIONS.map((dimension) => (
              <option key={dimension} value={dimension}>
                {USAGE_DIMENSION_META[dimension].option}
              </option>
            ))}
          </select>
        </label>
      ))}
      <p className="m-0 font-mono text-[11px] leading-relaxed text-fg-faint sm:col-span-3">
        Every dimension except session is kept in the daily usage rollup, so it covers the full history. Sessions come
        from the request log only and cover the retention window.
      </p>
    </div>
  )
}
