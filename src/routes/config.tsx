import { createFileRoute } from '@tanstack/react-router'
import { RouteConfigSkeleton } from '../components/skeleton/RouteConfigSkeleton'
import { ConfigPage } from '../features/config/ConfigPage'

export const Route = createFileRoute('/config')({
  ssr: false,
  component: ConfigPage,
  pendingComponent: RouteConfigSkeleton,
})
