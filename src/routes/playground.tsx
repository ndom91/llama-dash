import { createFileRoute } from '@tanstack/react-router'
import { RoutePlaygroundSkeleton } from '../components/skeleton/RoutePlaygroundSkeleton'
import { PlaygroundPage } from '../features/playground/PlaygroundPage'

export const Route = createFileRoute('/playground')({
  ssr: false,
  component: PlaygroundRoute,
  pendingComponent: RoutePlaygroundSkeleton,
})

function PlaygroundRoute() {
  const search = Route.useSearch() as { tab?: string }
  return <PlaygroundPage searchTab={search.tab} />
}
