import { createFileRoute } from '@tanstack/react-router'
import { RouteSkeleton } from '../components/RouteSkeleton'
import { ConfigPage } from '../features/config/ConfigPage'

export const Route = createFileRoute('/config')({
  ssr: false,
  component: ConfigPage,
  pendingComponent: () => <RouteSkeleton variant="config" />,
})
