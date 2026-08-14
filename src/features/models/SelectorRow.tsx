import { useNavigate } from '@tanstack/react-router'
import { StatusDot, stateTone } from '../../components/StatusDot'
import type { ApiModel } from '../../lib/api'
import { clickableRowFocusClass, clickableRowProps } from '../../lib/clickable-row-props'
import { cn } from '../../lib/cn'

type Props = {
  model: ApiModel
}

export function SelectorRow({ model }: Props) {
  const navigate = useNavigate()
  const selector = model.selector
  const tone = stateTone(model.state, model.running)

  if (!selector) return null

  return (
    <tr
      className={cn('clickable-row h-10 last:border-b last:border-border', clickableRowFocusClass)}
      {...clickableRowProps(() => navigate({ to: '/models/$id', params: { id: model.id } }))}
    >
      <td>
        <StatusDot tone={tone} live={model.running} />
      </td>
      <td>
        <span className="mono" translate="no">
          {model.id}
        </span>
      </td>
      <td>
        <span className="mono text-[11px] text-fg-dim">{selector.strategy}</span>
      </td>
      <td className="hide-mobile">
        <span className="mono text-[11px] text-fg-dim">{selector.targets.join(', ') || '—'}</span>
      </td>
      <td className="hide-mobile">
        <span className="mono text-[11px] text-fg-dim">{selector.spillover ?? '—'}</span>
      </td>
      <td className="hide-mobile">
        <span className={`state-label state-label-${tone}`}>{model.state}</span>
      </td>
    </tr>
  )
}
