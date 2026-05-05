import { ConfigPending } from './skeleton/ConfigPending'
import { LogsPending } from './skeleton/LogsPending'
import { PlaygroundPending } from './skeleton/PlaygroundPending'
import { RequestsPending } from './skeleton/RequestsPending'

type RouteSkeletonVariant = 'requests' | 'playground' | 'logs' | 'config'

type RouteSkeletonProps = {
  variant: RouteSkeletonVariant
}

export function RouteSkeleton({ variant }: RouteSkeletonProps) {
  if (variant === 'requests') return <RequestsPending />
  if (variant === 'logs') return <LogsPending />
  if (variant === 'config') return <ConfigPending />
  return <PlaygroundPending />
}
