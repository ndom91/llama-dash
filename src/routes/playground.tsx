import { createFileRoute } from '@tanstack/react-router'
import { PlaygroundPage } from '../features/playground/PlaygroundPage'

export const Route = createFileRoute('/playground')({ component: PlaygroundRoute })

function PlaygroundRoute() {
  const search = Route.useSearch() as { tab?: string }
  return <PlaygroundPage searchTab={search.tab} />
}
