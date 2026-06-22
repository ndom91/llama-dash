import { useNavigate } from '@tanstack/react-router'
import { Play, Power } from 'lucide-react'
import { StatusDot, stateTone } from '../../components/StatusDot'
import { Tooltip } from '../../components/Tooltip'
import type { ApiModel } from '../../lib/api'
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

  return (
    <tr
      className="clickable-row h-10 last:border-b last:border-border"
      onClick={() => navigate({ to: '/models/$id', params: { id: model.id } })}
    >
      <td>
        <StatusDot tone={tone} live={loading || model.running} />
      </td>
      <td className="mono" translate="no">
        {model.id}
      </td>
      <td>{model.name}</td>
      <td className="hide-mobile">
        <span className="mono" style={{ fontSize: 11, color: 'var(--fg-dim)' }}>
          {model.kind}
        </span>
      </td>
      <td className="hide-mobile">
        {capabilityBadges.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1">
            {capabilityBadges.slice(0, 2).map((capability) => (
              <span key={capability} className="state-label state-label-idle">
                {formatCapabilityLabel(capability)}
              </span>
            ))}
            {capabilityBadges.length > 2 ? (
              <span className="mono text-[11px] text-dim">+{capabilityBadges.length - 2}</span>
            ) : null}
          </div>
        ) : (
          <span className="mono dim" style={{ fontSize: 11 }}>
            —
          </span>
        )}
      </td>
      <td className="hide-mobile">
        <span className={`state-label state-label-${tone}`}>
          {loading ? 'loading' : unloading ? 'stopping' : model.kind === 'peer' ? 'peer' : model.state}
        </span>
      </td>
      <td className="num hide-mobile">
        {model.kind === 'local' ? (
          loading ? (
            <Tooltip label={`Loading ${model.id}`} side="left">
              <button type="button" className="btn btn-xs" disabled>
                <Play className="size-3 shrink-0" strokeWidth={2} aria-hidden="true" />
                loading…
              </button>
            </Tooltip>
          ) : unloading ? (
            <Tooltip label={`Unloading ${model.id}`} side="left">
              <button type="button" className="btn btn-xs" disabled>
                <Power className="size-3 shrink-0" strokeWidth={2} aria-hidden="true" />
                unloading…
              </button>
            </Tooltip>
          ) : model.running ? (
            <Tooltip label={`Unload ${model.id}`} side="left">
              <button
                type="button"
                className="btn btn-xs"
                onClick={(e) => {
                  e.stopPropagation()
                  onUnload()
                }}
              >
                <Power className="size-3 shrink-0" strokeWidth={2} aria-hidden="true" />
                unload
              </button>
            </Tooltip>
          ) : (
            <Tooltip label={`Load ${model.id}`} side="left">
              <button
                type="button"
                className="btn btn-xs"
                onClick={(e) => {
                  e.stopPropagation()
                  onLoad()
                }}
              >
                <Play className="size-3 shrink-0" strokeWidth={2} aria-hidden="true" />
                load
              </button>
            </Tooltip>
          )
        ) : (
          <span className="mono dim" style={{ fontSize: 11 }}>
            —
          </span>
        )}
      </td>
    </tr>
  )
}
