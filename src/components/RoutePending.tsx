import { ConfigPending } from './skeleton/ConfigPending'
import { LogsPending } from './skeleton/LogsPending'
import { PlaygroundPending } from './skeleton/PlaygroundPending'
import { RequestsPending } from './skeleton/RequestsPending'

type RoutePendingVariant = 'requests' | 'playground' | 'logs' | 'config'

type RoutePendingProps = {
  variant: RoutePendingVariant
}

export function RoutePending({ variant }: RoutePendingProps) {
  if (variant === 'requests') return <RequestsPending />
  if (variant === 'logs') return <LogsPending />
  if (variant === 'config') return <ConfigPending />
  return <PlaygroundPending />
}
