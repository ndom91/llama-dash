import { Link, useNavigate } from '@tanstack/react-router'
import type { MouseEvent } from 'react'
import { StatusDot, stateTone } from '../../components/StatusDot'
import type { ApiModel, ApiModelActivityEntry } from '../../lib/api'
import { clickableRowFocusClass, clickableRowProps } from '../../lib/clickable-row-props'
import { cn } from '../../lib/cn'
import { DashboardModelTrack } from './DashboardModelTrack'
import { MODEL_ROW_GRID, type ResidencyFrame, type ResidencySpan, formatClock, formatResident } from './modelResidency'

type Props = {
  model: ApiModel
  frame: ResidencyFrame
  spans: ReadonlyArray<ResidencySpan>
  color: string | null
  loadedAt: number | null
  activity: ApiModelActivityEntry | undefined
  bucketMs: number
  onLoad: (id: string) => void
  onUnload: (id: string) => void
}

const actionClass =
  'rounded-sm border border-border bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-fg-dim transition-colors duration-100 ease-out hover:border-border-strong hover:text-fg focus-visible:outline-2 focus-visible:outline-accent'

function stopRowActivation(event: MouseEvent) {
  event.stopPropagation()
}

export function DashboardModelRow({
  model,
  frame,
  spans,
  color,
  loadedAt,
  activity,
  bucketMs,
  onLoad,
  onUnload,
}: Props) {
  const navigate = useNavigate()
  const isPeer = model.kind === 'peer'
  const tone = isPeer ? 'idle' : stateTone(model.state, model.running)
  const stateLabel = isPeer ? 'peer' : model.running ? model.state : 'unloaded'
  const residentMs = spans.reduce((sum, span) => sum + (span.end - span.start), 0)
  const requests = activity?.total ?? 0
  const showName = model.name && model.name !== model.id

  return (
    <div
      className={cn(
        MODEL_ROW_GRID,
        'group relative min-h-12 cursor-pointer border-b border-border py-2 transition-colors duration-100 hover:bg-surface-2',
        clickableRowFocusClass,
      )}
      {...clickableRowProps(() => navigate({ to: '/models/$id', params: { id: model.id } }))}
    >
      <span className="flex justify-center">
        <StatusDot tone={tone} live={model.running && !isPeer} />
      </span>

      <div className="relative min-w-0">
        <div
          className={cn('truncate font-mono text-[12px]', model.running || isPeer ? 'text-fg' : 'text-fg-dim')}
          translate="no"
        >
          {model.id}
        </div>
        {showName ? <div className="truncate text-[11px] text-fg-dim">{model.name}</div> : null}
        {/* Hover actions cover the common cases so the "manage" jump isn't needed. */}
        <div className="absolute inset-y-0 right-0 flex items-center gap-1 bg-gradient-to-l from-surface-2 from-70% to-transparent pl-6 opacity-0 transition-opacity duration-100 group-focus-within:opacity-100 group-hover:opacity-100">
          {!isPeer && model.running ? (
            <button
              type="button"
              className={actionClass}
              onClick={(event) => {
                event.stopPropagation()
                onUnload(model.id)
              }}
            >
              unload
            </button>
          ) : null}
          {!isPeer && !model.running ? (
            <button
              type="button"
              className={actionClass}
              onClick={(event) => {
                event.stopPropagation()
                onLoad(model.id)
              }}
            >
              load
            </button>
          ) : null}
          {!isPeer ? (
            <Link to="/logs" search={{ q: model.id }} className={actionClass} onClick={stopRowActivation}>
              logs
            </Link>
          ) : null}
        </div>
      </div>

      <div className="min-w-0 font-mono max-[900px]:hidden">
        <div className={cn('text-[11px]', isPeer ? 'text-fg-dim' : `state-label state-label-${tone}`)}>
          {stateLabel}
        </div>
        {!isPeer && model.running && loadedAt != null ? (
          <div className="text-[10px] text-fg-faint">since {formatClock(loadedAt, frame.now)}</div>
        ) : null}
      </div>

      <DashboardModelTrack
        frame={frame}
        color={color}
        spans={spans}
        loading={model.running && model.state !== 'ready'}
        activity={activity}
        bucketMs={bucketMs}
        variant={isPeer ? 'peer' : 'local'}
        dim={!isPeer && !model.running}
      />

      <div className="text-right font-mono text-[11px] tabular-nums text-fg-dim max-[900px]:hidden">
        {isPeer ? '—' : residentMs > 0 ? formatResident(residentMs) : '—'}
      </div>
      <div className={cn('text-right font-mono text-[12px] tabular-nums', requests > 0 ? 'text-fg' : 'text-fg-faint')}>
        {requests.toLocaleString()}
      </div>
    </div>
  )
}
