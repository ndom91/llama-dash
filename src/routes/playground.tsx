import { createFileRoute } from '@tanstack/react-router'
import { RoutePending } from '../components/RoutePending'
import { PlaygroundPage } from '../features/playground/PlaygroundPage'

export const Route = createFileRoute('/playground')({
  ssr: false,
  component: PlaygroundRoute,
  pendingComponent: () => <RoutePending title="Playground" subtitle="loading chat workspace..." />,
})

function PlaygroundRoute() {
  const search = Route.useSearch() as { tab?: string }
  return <PlaygroundPage searchTab={search.tab} />
}
