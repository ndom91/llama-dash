import { createFileRoute } from '@tanstack/react-router'
import { RoutePending } from '../components/RoutePending'
import { ConfigPage } from '../features/config/ConfigPage'

export const Route = createFileRoute('/config')({
  ssr: false,
  component: ConfigPage,
  pendingComponent: () => <RoutePending variant="config" />,
})
