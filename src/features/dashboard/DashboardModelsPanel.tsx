import { Link } from '@tanstack/react-router'
import { ChevronRight } from 'lucide-react'
import { Fragment, useMemo, useState } from 'react'
import { SegmentedControl } from '../../components/SegmentedControl'
import type { ApiHealth, ApiModel, ApiModelActivityEntry } from '../../lib/api'
import { cn } from '../../lib/cn'
import { useLoadModel, useModelActivity, useModelTimeline, useUnloadModel } from '../../lib/queries'
import { assignSeriesSteps, seriesVar } from '../../lib/series-color'
import { DashboardModelGroupHeader } from './DashboardModelGroupHeader'
import { DashboardModelRow } from './DashboardModelRow'
import { DashboardModelsLegend } from './DashboardModelsLegend'
import { DashboardModelsPanelSkeleton } from './DashboardModelsPanelSkeleton'
import {
  DEFAULT_RESIDENCY_WINDOW_MS,
  MODEL_ROW_GRID,
  RESIDENCY_WINDOWS,
  type ResidencyFrame,
  type ResidencyWindowMs,
  axisLabels,
  buildResidencySpans,
  derivePeerHealth,
  groupModels,
  lastLoadTimes,
} from './modelResidency'

type Props = {
  models: Array<ApiModel> | undefined
  health: ApiHealth | undefined
}

const EMPTY_SPANS: never[] = []

export function DashboardModelsPanel({ models, health }: Props) {
  const [windowMs, setWindowMs] = useState<ResidencyWindowMs>(DEFAULT_RESIDENCY_WINDOW_MS)
  const [showUnloaded, setShowUnloaded] = useState(false)
  const { data: events } = useModelTimeline(windowMs)
  const { data: activity } = useModelActivity(windowMs)
  const loadModel = useLoadModel()
  const unloadModel = useUnloadModel()

  const localHost = health?.upstream.reachable ? health.upstream.host : null

  const counts = useMemo(() => {
    const list = models?.filter((m) => m.kind !== 'selector') ?? []
    return {
      configured: list.length,
      running: list.filter((m) => m.kind === 'local' && m.running).length,
      peers: list.filter((m) => m.kind === 'peer').length,
      unloaded: list.filter((m) => m.kind === 'local' && !m.running).length,
    }
  }, [models])

  const groups = useMemo(() => groupModels(models ?? [], showUnloaded, localHost), [models, showUnloaded, localHost])

  // The activity response is bucket-aligned; use its range as the frame so
  // ticks and spans share one time axis. Before it arrives, fall back to
  // "the last windowMs". `now` is derived inside the memo — as a render-body
  // dependency it would invalidate the memo on every render.
  const { frame, spans, loadedAt } = useMemo(() => {
    const now = Date.now()
    const frame: ResidencyFrame =
      activity && activity.windowMs === windowMs
        ? { start: activity.since, end: activity.since + activity.windowMs, now }
        : { start: now - windowMs, end: now, now }
    return {
      frame,
      spans: buildResidencySpans(events ?? [], frame),
      loadedAt: lastLoadTimes(events ?? []),
    }
  }, [events, activity, windowMs])

  const activityByModel = useMemo(
    () => new Map<string, ApiModelActivityEntry>(activity?.models.map((entry) => [entry.model, entry]) ?? []),
    [activity],
  )

  // Identity colours are hashed from the model id (not list position) and only
  // spent on local models — peers have no local residency to colour.
  const seriesSteps = useMemo(
    () => assignSeriesSteps(groups.flatMap((g) => (g.kind === 'local' ? g.models.map((m) => m.id) : []))),
    [groups],
  )

  const labels = axisLabels(windowMs)
  const bucketMs = activity?.bucketMs ?? windowMs

  return (
    <section className="panel border-t !rounded-none !border-x-0 !border-t-0 !bg-surface-1">
      <div className="panel-head flex-wrap bg-transparent px-4 max-[700px]:h-auto">
        <span className="panel-title">Models</span>
        <span className="panel-sub">
          {models == null
            ? '—'
            : `${counts.running} running${counts.peers > 0 ? ` · ${counts.peers} peer` : ''} · ${counts.configured} configured`}
        </span>
        <div className="ml-auto flex items-center gap-3">
          {counts.unloaded > 0 ? (
            <label className="flex cursor-pointer items-center gap-1.5 font-mono text-[11px] text-fg-dim transition-colors hover:text-fg">
              <input
                type="checkbox"
                className="accent-accent"
                checked={showUnloaded}
                onChange={(event) => setShowUnloaded(event.target.checked)}
              />
              show unloaded ({counts.unloaded})
            </label>
          ) : null}
          <SegmentedControl
            legend="Residency window"
            options={RESIDENCY_WINDOWS}
            value={windowMs}
            onChange={setWindowMs}
          />
          <Link to="/models" className="panel-link inline-flex items-center gap-1 font-mono text-[11px]">
            manage
            <ChevronRight className="size-3 shrink-0" strokeWidth={2} aria-hidden="true" />
          </Link>
        </div>
      </div>

      <div
        className={cn(
          MODEL_ROW_GRID,
          'h-8 border-b border-border font-mono text-[10px] uppercase tracking-[0.1em] text-fg-faint',
        )}
      >
        <span />
        <span>model</span>
        <span className="max-[900px]:hidden">state</span>
        <div className="relative h-3 normal-case tracking-normal" aria-hidden="true">
          {labels.map((tick) => (
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
        <span className="text-right max-[900px]:hidden">resident</span>
        <span className="text-right">req</span>
      </div>

      {models == null ? (
        <DashboardModelsPanelSkeleton />
      ) : groups.length === 0 ? (
        <div className="empty-state border-b border-border">
          idle — no models loaded. Hit <code translate="no">/v1/chat/completions</code> to swap one in.
        </div>
      ) : (
        groups.map((group) => (
          <Fragment key={group.key}>
            <DashboardModelGroupHeader
              kind={group.kind}
              host={group.host}
              health={group.kind === 'peer' ? derivePeerHealth(group.models, activityByModel) : undefined}
              now={frame.now}
            />
            {group.models.map((model) => {
              const step = seriesSteps.get(model.id)
              return (
                <DashboardModelRow
                  key={model.id}
                  model={model}
                  frame={frame}
                  spans={group.kind === 'local' ? (spans.get(model.id) ?? EMPTY_SPANS) : EMPTY_SPANS}
                  color={group.kind === 'local' && step != null ? seriesVar(step) : null}
                  loadedAt={loadedAt.get(model.id) ?? null}
                  activity={activityByModel.get(model.id)}
                  bucketMs={bucketMs}
                  onLoad={(id) => loadModel.mutate(id)}
                  onUnload={(id) => unloadModel.mutate(id)}
                />
              )
            })}
          </Fragment>
        ))
      )}

      <DashboardModelsLegend />
    </section>
  )
}
