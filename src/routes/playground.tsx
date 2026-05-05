import { createFileRoute } from '@tanstack/react-router'
import { RouteSkeleton } from '../components/RouteSkeleton'
import { PlaygroundPage } from '../features/playground/PlaygroundPage'

export const Route = createFileRoute('/playground')({
  ssr: false,
  component: PlaygroundRoute,
  pendingComponent: () => <RouteSkeleton variant="playground" />,
})

function PlaygroundRoute() {
  const search = Route.useSearch() as { tab?: string }
  return <PlaygroundPage searchTab={search.tab} />
}
