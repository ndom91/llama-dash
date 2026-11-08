import { useNavigate } from '@tanstack/react-router'
import { Play, Power } from 'lucide-react'
import { CopyButton } from '../../components/CopyButton'
import { StatusDot, stateTone } from '../../components/StatusDot'
import { Tooltip } from '../../components/Tooltip'
import type { ApiModel } from '../../lib/api'
import { clickableRowFocusClass, clickableRowProps } from '../../lib/clickable-row-props'
import { cn } from '../../lib/cn'
import { formatCapabilityLabel, getModelCapabilityBadges } from './modelUtils'

type Props = {
  model: ApiModel
  loading: boolean
  unloading: boolean
  onLoad: () => void
  onUnload: () => void
}

export function ModelRow({ model, loading, unloading, onLoad, onUnload }: Props) {
  const navigate = useNavigate()
  const tone = loading
    ? ('warn' as const)
    : unloading
      ? ('idle' as const)
      : model.kind === 'peer'
        ? ('warn' as const)
        : stateTone(model.state, model.running)
  const capabilityBadges = getModelCapabilityBadges(model)
  const pending = loading || unloading
  const actionDescription = loading ? 'Loading' : unloading ? 'Unloading' : model.running ? 'Unload' : 'Load'
  const ActionIcon = unloading || (!loading && model.running) ? Power : Play

  return (
    <tr
      className={cn('clickable-row h-10 last:border-b last:border-border', clickableRowFocusClass)}
      {...clickableRowProps(() => navigate({ to: '/models/$id', params: { id: model.id } }))}
    >
      <td className="model-row-dot">
        <StatusDot tone={tone} live={loading || model.running} />
      </td>
      <td className="model-row-id">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="mono max-md:break-all" translate="no">
            {model.id}
          </span>
          <Tooltip label="Copy model slug" side="top">
            <span className="inline-flex shrink-0">
              <CopyButton text={model.id} variant="icon" ariaLabel={`Copy model slug ${model.id}`} stopPropagation />
            </span>
          </Tooltip>
          {capabilityBadges.length > 0 ? (
            <span className="contents max-[768px]:hidden">
              <span className="sr-only">Capabilities: </span>
              {capabilityBadges.map((capability) => (
                <span
                  key={capability}
                  className="inline-flex rounded-sm border border-border bg-surface-2 px-1.5 py-0.5 font-mono text-[9px] leading-none tracking-[0.08em] text-fg-dim [text-box:trim-both_cap_alphabetic]"
                >
                  {formatCapabilityLabel(capability)}
                </span>
              ))}
            </span>
          ) : null}
        </div>
      </td>
      <td className={cn('model-row-name', model.name === model.id && 'max-[768px]:hidden')}>{model.name}</td>
      <td className="hide-mobile">
        <span className="mono" style={{ fontSize: 11, color: 'var(--fg-dim)' }}>
          {model.kind}
        </span>
      </td>
      <td className="hide-mobile model-row-state">
        <span className={`state-label state-label-${tone}`}>
          {loading ? 'loading' : unloading ? 'stopping' : model.kind === 'peer' ? 'peer' : model.state}
        </span>
      </td>
      <td className="num hide-mobile model-row-action">
        {model.kind === 'local' ? (
          <Tooltip label={`${actionDescription} ${model.id}`} side="left">
            <button
              type="button"
              className="btn btn-xs"
              disabled={pending}
              aria-label={`${actionDescription} ${model.id}`}
              onClick={(event) => {
                event.stopPropagation()
                if (model.running) onUnload()
                else onLoad()
              }}
            >
              <ActionIcon className="size-3 shrink-0" strokeWidth={2} aria-hidden="true" />
              <span className={cn('copy-text-swap', pending && 'copy-text-swap-done')} aria-hidden="true">
                <span className="copy-text-swap-from">{model.running ? 'unload' : 'load'}</span>
                <span className="copy-text-swap-to">{unloading ? 'unloading…' : 'loading…'}</span>
              </span>
            </button>
          </Tooltip>
        ) : (
          <span className="mono dim max-[768px]:hidden" style={{ fontSize: 11 }}>
            —
          </span>
        )}
      </td>
    </tr>
  )
}
