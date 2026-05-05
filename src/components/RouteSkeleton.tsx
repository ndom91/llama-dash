import { RouteConfigSkeleton, RouteLogsSkeleton, RoutePlaygroundSkeleton, RouteRequestsSkeleton } from './skeleton'

type RouteSkeletonVariant = 'requests' | 'playground' | 'logs' | 'config'

type RouteSkeletonProps = {
  variant: RouteSkeletonVariant
}

export function RouteSkeleton({ variant }: RouteSkeletonProps) {
  if (variant === 'requests') return <RouteRequestsSkeleton />
  if (variant === 'logs') return <RouteLogsSkeleton />
  if (variant === 'config') return <RouteConfigSkeleton />
  return <RoutePlaygroundSkeleton />
}
