import { createFileRoute } from '@tanstack/react-router'
import { RouteSkeleton } from '../components/RouteSkeleton'
import { LogsPage } from '../features/logs/LogsPage'

export const Route = createFileRoute('/logs')({
  ssr: false,
  component: LogsPage,
  pendingComponent: () => <RouteSkeleton variant="logs" />,
})
