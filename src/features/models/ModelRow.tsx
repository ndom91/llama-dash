import { useNavigate } from '@tanstack/react-router'
import { Play, Power } from 'lucide-react'
import { StatusDot, stateTone } from '../../components/StatusDot'
import type { ApiModel } from '../../lib/api'

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

  return (
    <tr className="clickable-row" onClick={() => navigate({ to: '/models/$id', params: { id: model.id } })}>
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
        <span className={`state-label state-label-${tone}`}>{loading ? 'loading' : unloading ? 'stopping' : model.kind === 'peer' ? 'peer' : model.state}</span>
      </td>
      <td className="num hide-mobile">
        {model.kind === 'local' ? (
          loading ? (
            <button type="button" className="btn btn-xs" disabled title={`Loading ${model.id}`}>
              <Play className="icon-btn-12" strokeWidth={2} aria-hidden="true" />
              loading…
            </button>
          ) : unloading ? (
            <button type="button" className="btn btn-xs" disabled title={`Unloading ${model.id}`}>
              <Power className="icon-btn-12" strokeWidth={2} aria-hidden="true" />
              unloading…
            </button>
          ) : model.running ? (
            <button
              type="button"
              className="btn btn-xs"
              onClick={(e) => {
                e.stopPropagation()
                onUnload()
              }}
              title={`Unload ${model.id}`}
            >
              <Power className="icon-btn-12" strokeWidth={2} aria-hidden="true" />
              unload
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-xs"
              onClick={(e) => {
                e.stopPropagation()
                onLoad()
              }}
              title={`Load ${model.id}`}
            >
              <Play className="icon-btn-12" strokeWidth={2} aria-hidden="true" />
              load
            </button>
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
