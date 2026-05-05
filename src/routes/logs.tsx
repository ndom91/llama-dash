import { createFileRoute } from '@tanstack/react-router'
import { RoutePending } from '../components/RoutePending'
import { LogsPage } from '../features/logs/LogsPage'

export const Route = createFileRoute('/logs')({
  ssr: false,
  component: LogsPage,
  pendingComponent: () => <RoutePending variant="logs" />,
})
