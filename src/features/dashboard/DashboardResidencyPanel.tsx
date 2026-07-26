import { useMemo } from 'react'
import { cn } from '../../lib/cn'
import type { ApiModel, ApiModelEvent } from '../../lib/api'
import { assignSeriesSteps, seriesVar } from '../../lib/series-color'
import { DASHBOARD_WINDOW_MS, buildResidencySpans, formatDurationMinutes } from './dashboardUtils'

type Props = {
  events: Array<ApiModelEvent>
  active: Array<ApiModel>
}

/** Shared by the model rows and the time axis so the two cannot drift apart. */
const TRACK_GRID = 'grid grid-cols-[220px_minmax(0,1fr)_48px] gap-3 max-[900px]:grid-cols-[minmax(0,1fr)_48px]'

/** Percent offsets into the window, matching how span positions are computed. */
const AXIS_TICKS = [
  { at: 0, label: '-60m' },
  { at: 25, label: '-45m' },
  { at: 50, label: '-30m' },
  { at: 75, label: '-15m' },
  { at: 100, label: 'now' },
]

export function DashboardResidencyPanel({ events, active }: Props) {
  // `now` is derived inside the memo rather than in the render body — as a
  // dependency it invalidated the memo on literally every render.
  const { spans, windowStart } = useMemo(() => {
    const now = Date.now()
    return { spans: buildResidencySpans(events, now), windowStart: now - DASHBOARD_WINDOW_MS }
  }, [events])

  const peerIds = useMemo(() => new Set(active.filter((m) => m.kind === 'peer').map((m) => m.id)), [active])

  // Identity colors are keyed by a hash of the model id, not by list position:
  // position-keyed colors changed whenever a *different* model loaded/unloaded.
  // Peers never receive an identity color, so they don't consume a step.
  const seriesSteps = useMemo(
    () => assignSeriesSteps(active.filter((m) => m.kind !== 'peer').map((m) => m.id)),
    [active],
  )

  const rows = useMemo(() => {
    const byModel = new Map<string, Array<(typeof spans)[number]>>()
    for (const span of spans) {
      const arr = byModel.get(span.modelId) ?? []
      arr.push(span)
      byModel.set(span.modelId, arr)
    }

    return active.map((model) => ({
      id: model.id,
      label: model.name || model.id,
      kind: model.kind,
      spans: byModel.get(model.id) ?? [],
    }))
  }, [active, spans])

  return (
    <section className="panel !rounded-none !border-x-0 !border-t-0 !bg-surface-1">
      <div className="panel-head border-b border-border bg-transparent px-4">
        <span className="panel-title">Model residency</span>
        <span className="panel-sub">· 60 min</span>
        <span className="panel-sub ml-auto flex items-center gap-1.5">
          {active.filter((m) => m.running && m.kind !== 'peer').length} resident
          {peerIds.size > 0 ? (
            <>
              <span aria-hidden="true">·</span>
              <span className="series-legend-swatch-peer inline-block h-2 w-2 shrink-0 rounded-sm" aria-hidden="true" />
              {peerIds.size} peer
            </>
          ) : null}
        </span>
      </div>
      <div className="flex flex-col gap-2 p-4">
        {rows.length === 0 ? (
          <div className="empty-state !p-0">no active model residency in the last hour</div>
        ) : (
          rows.map((row) => {
            const totalMs = row.spans.reduce((sum, span) => sum + (span.end - span.start), 0)
            const isPeer = row.kind === 'peer'
            return (
              <div key={row.id} className={cn(TRACK_GRID, 'items-center')}>
                <div className="truncate mono text-[11px] text-fg max-[900px]:hidden" translate="no">
                  {row.id}
                  <span className="dim">{isPeer ? ' · peer' : ''}</span>
                </div>
                <div className="relative h-4 overflow-hidden rounded bg-surface-3">
                  {row.spans.map((span) => {
                    const left = ((span.start - windowStart) / DASHBOARD_WINDOW_MS) * 100
                    const width = ((span.end - span.start) / DASHBOARD_WINDOW_MS) * 100
                    return (
                      <span
                        key={`${row.id}-${span.start}`}
                        className={cn('absolute top-0 bottom-0 rounded', isPeer && 'series-span-peer')}
                        style={{
                          left: `${left}%`,
                          // Peers get a slightly larger floor so a short span
                          // still shows at least one hatch stripe.
                          width: `${Math.max(width, isPeer ? 1.2 : 0.8)}%`,
                          background: isPeer ? undefined : seriesVar(seriesSteps.get(row.id) ?? 0),
                        }}
                      />
                    )
                  })}
                </div>
                <div className="text-right mono text-[11px] text-fg-dim">{formatDurationMinutes(totalMs)}</div>
              </div>
            )
          })
        )}
        {/* Axis shares the row grid and positions ticks at the same percent
            offsets the spans use, so the labels actually sit over the time
            they describe. */}
        <div className={cn(TRACK_GRID, 'mt-1')} aria-hidden="true">
          <div className="max-[900px]:hidden" />
          <div className="relative h-3 mono text-[10px] text-fg-dim">
            {AXIS_TICKS.map((tick) => (
              <span
                key={tick.at}
                className="absolute top-0 whitespace-nowrap"
                style={{
                  left: `${tick.at}%`,
                  transform: tick.at === 0 ? 'none' : tick.at === 100 ? 'translateX(-100%)' : 'translateX(-50%)',
                }}
              >
                {tick.label}
              </span>
            ))}
          </div>
          <div />
        </div>
      </div>
    </section>
  )
}
